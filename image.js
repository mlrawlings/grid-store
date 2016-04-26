var gm = require('gm')

exports.mime = /^image\//

exports.format = function(file, meta, params, fn) {
	var image = gm(file)
	var focus = meta.focus
	var size = {}
	var crop = {}
	var target = parseParams(params)
	var current = {
		width:meta.size.width,
		height:meta.size.height
	}
	current.ratio = current.width/current.height

	normalizeTarget()

	if(target.ratio) calcCropDimensions()
	if(target.width) calcConstraints('width')
	if(target.height) calcConstraints('height')
	if(target.zoom) calcZoom()
	if(target.ratio) calcCropOffset()

	image = image.resize(size.width, size.height)
	
	if(target.ratio) {
		image = image.crop(crop.width, crop.height, crop.x, crop.y)
	}
	
	return fn(null, image.stream())

	function normalizeTarget() {
		if(target.width && target.height) {
			target.ratio = target.width/target.height
		} else if(target.ratio && target.width && !target.height) {
			target.height = target.width/target.ratio
		} else if(target.ratio && !target.width && target.height) {
			target.width = target.height*target.ratio
		}
	}

	function calcZoom() {
		crop.width /= target.zoom
		crop.height /= target.zoom
	}

	function calcCropOffset() {
		crop.x = focus.x*(size.width-crop.width)
		crop.y = focus.y*(size.height-crop.height)
	}

	function calcCropDimensions() {
		if(current.ratio > target.ratio) {
			crop.height = current.height
			crop.width = current.height*target.ratio
		} else {
			crop.height = current.width/target.ratio
			crop.width = current.width
		}
	}

	function calcConstraints(dim) {
		var ratio

		size.width = size.width || current.width
		size.height = size.height || current.height
		
		ratio = target[dim]/(crop[dim] || size[dim])

		if(ratio < 1) {
			size.width *= ratio
			size.height *= ratio
			if(crop[dim]) {
				crop.width *= ratio
				crop.height *= ratio
			}
		}
	}
}

exports.meta = function(file, meta, fn) {
	gm(file).size((err, size) => {
		if(err) return fn(err)
		metadata.size = size
		fn()
	})
	if(false) {
		// automatically detect focal point of image
	} else {
		metadata.focus = { x:0.5, y:0.5 }
	}
}

function parseParams(params) {
	var parsed = {}
	params.forEach(param => {
		var match
		
		if(match = /^(\d+)x(\d+)max$/.exec(param)) {
			parsed.maxWidth = parseInt(match[1])
			parsed.maxHeight = parseInt(match[2])
		} else if(match = /^(\d+)x(\d+)$/.exec(param)) {
			parsed.width = parseInt(match[1])
			parsed.height = parseInt(match[2])
		} else if(match = /^(\d+)wmax$/.exec(param)) {
			parsed.maxWidth = parseInt(match[1])
		} else if(match = /^(\d+)w$/.exec(param)) {
			parsed.width = parseInt(match[1])
		} else if(match = /^(\d+)hmax$/.exec(param)) {
			parsed.maxHeight = parseInt(match[1])
		} else if(match = /^(\d+)h$/.exec(param)) {
			parsed.height = parseInt(match[1])
		} else if(match = /^(\d+)-(\d+)$/.exec(param)) {
			parsed.ratio = parseInt(match[1])/parseInt(match[2])
		}
	})
	return parsed
}