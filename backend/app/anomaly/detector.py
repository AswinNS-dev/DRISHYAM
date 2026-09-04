"""
Anomaly detection: flags entities whose interaction frequency, new-connection
rate, or network growth deviates significantly from their own historical
baseline (z-score), rather than an arbitrary global threshold. Every anomaly
carries an explanation and an evidence count, per the hallucination-control
requirement — nothing is flagged without a numeric reason.
"""
import statistics
from datetime import datetime
from typing import List, Dict, Any


def zscore_anomalies(entity_counts: Dict[str, List[int]], baseline_window: int = 3) -> List[Dict[str, Any]]:
    """
    entity_counts: {entity_id: [count_period_1, count_period_2, ..., count_latest]}
    Flags entities where the latest period count is a statistical outlier
    versus their own prior periods.
    """
    anomalies = []
    for entity_id, series in entity_counts.items():
        if len(series) < baseline_window + 1:
            continue
        baseline = series[:-1]
        latest = series[-1]
        mean = statistics.mean(baseline)
        stdev = statistics.pstdev(baseline) or 0.5
        z = (latest - mean) / stdev
        if z >= 2.0 and mean > 0:
            ratio = latest / mean if mean else latest
            anomalies.append({
                "entity_id": entity_id,
                "anomaly_type": "COMMUNICATION_BURST" if latest > mean else "ACTIVITY_DROP",
                "reason": f"Activity increased {ratio:.1f}x above historical baseline "
                          f"(z-score {z:.2f}).",
                "severity": "high" if z >= 3.0 else "medium",
                "z_score": round(z, 2),
                "latest_count": latest,
                "baseline_mean": round(mean, 2),
            })
    return anomalies


def new_connection_burst(entity_id: str, historical_avg_new_edges: float, latest_new_edges: int) -> Dict[str, Any] | None:
    if historical_avg_new_edges <= 0:
        return None
    ratio = latest_new_edges / historical_avg_new_edges
    if ratio >= 2.5 and latest_new_edges >= 3:
        return {
            "entity_id": entity_id,
            "anomaly_type": "SUDDEN_NETWORK_EXPANSION",
            "reason": f"{latest_new_edges} new relationships appeared this period versus a "
                      f"baseline average of {historical_avg_new_edges:.1f} — {ratio:.1f}x expansion.",
            "severity": "high" if ratio >= 4 else "medium",
        }
    return None
