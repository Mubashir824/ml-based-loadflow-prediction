"""
Newton-Raphson load flow solver (pandapower), used to verify ML predictions.

Runs inside worker processes only: pandapower is not thread-safe, and keeping
it out of the API process means a solver crash cannot take the server down.

Solver settings deliberately match the dataset-generation notebook
(Dataset_dev.ipynb): pandapower's default ``pp.runpp(net)`` on ``case14()`` —
Newton-Raphson, 1e-8 MVA tolerance, automatic iteration limit, DC-initialised,
no generator Q-limit enforcement. A case is reported as converged exactly when
it would have produced a sample in the training dataset.
"""

import math
import warnings

V_LOW, V_HIGH = 0.95, 1.05

# Same topology-code maps as main.py / script.js.
CODE_TO_LOAD = {20: 1, 23: 2, 24: 3, 25: 4, 26: 5,
                27: 6, 28: 7, 29: 8, 30: 9, 21: 10, 22: 11}
CODE_TO_LINE = {5: 1, 12: 2, 13: 3, 14: 4, 15: 5, 16: 6, 17: 7, 18: 8, 19: 9,
                6: 10, 7: 11, 8: 12, 9: 13, 10: 14, 11: 15}

_net = None  # one IEEE 14-bus network per worker process, reused across cases


def init_worker() -> None:
    """Process-pool initializer: import pandapower and build the network once."""
    global _net
    warnings.filterwarnings("ignore")
    import pandapower.networks as pn
    _net = pn.case14()


def solve_one(features: list) -> dict:
    """Solve one scenario (P1-P11, Q1-Q11, topology code).

    Returns a dict shaped like an ML inference result, plus ``converged``.
    Non-converged cases return only ``converged=False`` and the solver error —
    never any operating-point values.
    """
    import pandapower as pp

    if _net is None:
        init_worker()
    net = _net

    P_vals = [float(x) for x in features[:11]]
    Q_vals = [float(x) for x in features[11:22]]
    topo = int(features[22])
    if any(math.isnan(x) for x in P_vals + Q_vals):
        return {"converged": False, "error": "Invalid input: NaN in load values."}

    # Reset to the intact network, then apply this scenario's contingency
    # (the generation notebook resets the same way after each contingency).
    for table in (net.line, net.load, net.gen, net.shunt):
        table["in_service"] = True
    if   topo in CODE_TO_LINE: net.line.at[CODE_TO_LINE[topo] - 1, "in_service"] = False
    elif topo in CODE_TO_LOAD: net.load.at[CODE_TO_LOAD[topo] - 1, "in_service"] = False
    elif 1 <= topo <= 4:       net.gen.at[topo - 1, "in_service"] = False
    elif topo == 31:           net.shunt.at[0, "in_service"] = False

    net.load["p_mw"]   = P_vals
    net.load["q_mvar"] = Q_vals

    try:
        # numba=False only skips JIT compilation; the numerical result is identical.
        pp.runpp(net, numba=False)
    except Exception as e:
        return {"converged": False, "error": f"{type(e).__name__}: {e}"}

    vm = net.res_bus["vm_pu"].values.tolist()
    va = net.res_bus["va_degree"].values.tolist()
    il = net.res_line["i_ka"].values.tolist()
    pf = net.res_line["p_from_mw"].values.tolist()
    pt = net.res_line["p_to_mw"].values.tolist()
    pl = net.res_line["pl_mw"].values.tolist()
    qf = net.res_line["q_from_mvar"].values.tolist()
    qt = net.res_line["q_to_mvar"].values.tolist()
    ql = net.res_line["ql_mvar"].values.tolist()

    if topo in CODE_TO_LINE:
        idx = CODE_TO_LINE[topo] - 1
        for lst in (il, pf, pt, pl, qf, qt, ql):
            lst[idx] = 0.0

    voltage_violations = [
        {"bus": f"V{j+2}", "value": round(val, 4),
         "type": "low" if val < V_LOW else "high"}
        for j, val in enumerate(vm[1:])
        if val < V_LOW or val > V_HIGH
    ]

    return {
        "converged":    True,
        "V_all":        vm,
        "A_all":        va,
        "V2_V14":       vm[1:],
        "Angle_2_14":   va[1:],
        "P_send":       pf,
        "P_rec":        pt,
        "P_loss":       pl,
        "Total_P_Loss": float(sum(pl)),
        "Q_send":       qf,
        "Q_rec":        qt,
        "Q_loss":       ql,
        "Total_Q_Loss": float(sum(ql)),
        "Line_Currents":    il,
        "Line_Loading_Pct": [round(float(c) * 100, 2) for c in il],
        "voltage_violations": voltage_violations,
        "has_violations":     len(voltage_violations) > 0,
        "iterations":   int(net._ppc.get("iterations", -1))
                        if hasattr(net, "_ppc") and net._ppc else -1,
    }


def solve_rows(rows: list) -> list:
    """Solve a chunk of ``(key, features)`` pairs; returns ``(key, result)`` pairs."""
    return [(key, solve_one(features)) for key, features in rows]
