prod:
	npm run build
	(cd dist && web-ext build --overwrite-dest)
edge:
	npm run build:edge
	(cd dist-edge && web-ext build --overwrite-dest -n libby-download-edge.zip)
