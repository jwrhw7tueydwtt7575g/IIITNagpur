.PHONY: eval test sim demo

eval:
	python3 -m eval.run

test:
	pytest -q

sim:
	python3 -c "import yaml; from sim.city_sim import CitySim; c=yaml.safe_load(open('configs/default.yaml')); s=CitySim(c); s.run(); s.log_ground_truth(c['output']['ground_truth_path']); s.save_observations('data/observations.jsonl'); print('sim done')"

demo:
	(cd backend && python3 -m uvicorn main:app --port 8000) &
	cd frontend && npm run dev
