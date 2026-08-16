.PHONY: dev test

dev:   ## serve the folder. In an editor, the Live Server extension does the same thing
	python3 -m http.server 8000

test:  ## the tests are a web page — open it and read the PASS/FAIL rows
	@echo "run 'make dev', then open http://localhost:8000/tests/rules.test.html"
