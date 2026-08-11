.PHONY: dev check test build all

dev:    ## run the dev server (TypeScript transpiled on the fly, hot reload)
	bun ./index.html

check:  ## typecheck. Bun strips types WITHOUT checking them, so this is the real gate
	bunx tsc --noEmit

test:
	bun test

build:
	bun build ./index.html --minify --outdir=dist --sourcemap

all: check test build
