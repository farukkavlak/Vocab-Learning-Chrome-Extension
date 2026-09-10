PY := .venv/bin/python

setup:
	python3 -m venv .venv
	.venv/bin/pip install -q -r requirements.txt
	$(PY) scripts/setup_nltk.py

pool:
	$(PY) scripts/fetch_corpus.py
	$(PY) scripts/word_frequency.py

candidates:
	$(PY) scripts/pick_candidates.py

label:
	$(PY) scripts/label.py $(if $(REDO),--redo $(REDO))

split:
	$(PY) scripts/split.py

baseline:
	$(PY) scripts/baseline.py

recheck:
	$(PY) scripts/recheck.py

clean:
	rm -rf .venv data/raw __pycache__ scripts/__pycache__

.PHONY: setup pool candidates label split baseline recheck clean
