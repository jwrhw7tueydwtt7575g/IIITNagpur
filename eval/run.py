from pathlib import Path
import json

from eval.harness import run_eval

out_dir = Path("eval/report")
out_dir.mkdir(parents=True, exist_ok=True)
res = run_eval()
(out_dir / "metrics.json").write_text(json.dumps(res, indent=2))

rows = ""
for h, m in res["horizons"].items():
    rows += f"<tr><td>{h}h</td><td>{m['mae']}</td><td>{m['state_acc']}</td><td>{m['n']}</td></tr>"

html = f"""<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>The 72-Hour Warning - Evaluation</title>
<style>
body{{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;}}
table{{border-collapse:collapse;width:100%;}}
th,td{{border:1px solid #ccc;padding:8px;text-align:center;}}
</style>
</head>
<body>
<h1>The 72-Hour Warning - Baseline Evaluation</h1>
<p>Eval times: {res['n_eval_times']}</p>
<table>
<tr><th>Horizon</th><th>MAE risk</th><th>State accuracy</th><th>Samples</th></tr>
{rows}
</table>
<p>Baseline: heuristic risk estimate + persistence. Replace with particle filter in later steps.</p>
</body>
</html>"""
(out_dir / "index.html").write_text(html)
print(json.dumps(res, indent=2))
print(f"Wrote {out_dir/'index.html'}")
