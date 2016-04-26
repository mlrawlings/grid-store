var fs = require('fs')
var path = require('path')
var mkdirp = require('mkdirp')
var Busboy = require('busboy')
var Grid = require('gridfs-stream')

var pathRegex = /^\/([0-9a-f]{24})(?:((?:\/[^\/]+)*)\/([^\/]+\.[0-9a-z]+)|\/?)$/i

module.exports = function(options) {
	var gfs

	options = options || {}
	options.cacheDir = options.cacheDir || path.join(__dirname, './cache')
	options.handlers = [require('./image')]

	if(options.mongoose) {
		gfs = Grid(options.mongoose.connection.db, options.mongoose.mongo)
	} else {
		gfs = Grid(options.db, options.mongo)
	}

	return function middleware(req, res, next) {
		if(req.method === 'GET') return serve(req, res, next)
		if(req.method === 'POST') return upload(req, res, next)
		if(req.method === 'PUT') return updateMeta(req, res, next)
	}

	function serve(req, res, next) {
		var parts = pathRegex.exec(req.path)
		
		if(!parts) {
			return res.status(400).end()
		}

		var _id = parts[1]
		var params = parts[2]
		var filename = parts[3]
		
		if(!filename) serveMeta(_id, req, res, next)
		else if(!params) serveFromGrid(_id, req, res, next)
		else serveFromCache(_id, params, req, res, next)
	}

	function serveFromCache(_id, params, req, res, next) {
		var stream = fs.createReadStream(path.join(options.cacheDir, req.path))

		stream.on('error', error => {
			console.log('not cached')
			createCacheServe(_id, params, req, res, next)
		})

		stream.pipe(res)
	}

	function createCacheServe(_id, params, req, res, next) {
		params = params.slice(1).split(/\//g)

		gfs.findOne({ _id }, (err, file) => {
			if(err) return next(err)
			if(!file) return res.status(404).end()

			var cachePath = path.join(options.cacheDir, req.path.slice(1))
			mkdirp(path.dirname(cachePath), err => {
				if(err) return next(err)
				
				var handled = options.handlers.some(handler => {
					if(!handler.format) return
					if(!handler.mime.test(file.contentType)) return

					handler.format(gfs.createReadStream({ _id }), file.metadata, params, (err, stream) => {
						if(err) return next(err)

						stream.on('error', next)

						stream.pipe(fs.createWriteStream(cachePath))
						stream.pipe(res)
					})

					return true
				})

				if(!handled) return res.status(404).end()
			})
		})
	}

	function serveFromGrid(_id, req, res, next) {
		var stream = gfs.createReadStream({ _id })

		stream.on('error', error => {
			res.status(404).end()
		})

		stream.pipe(res)
	}

	function serveMeta(_id, req, res, next) {
		gfs.findOne({ _id }, (err, file) => {
			if(err) return next(err)
			res.json(file)
		})
	}

	function upload(req, res, next) {
		if(!req.is('multipart/form-data')) return next()

		var files = []
		var remaining = 0
		var finished = false
		var busboy = new Busboy({ headers: req.headers })

		busboy.on('file', function(fieldname, file, filename, encoding, content_type) {
			var writestream = gfs.createWriteStream({ filename, content_type })
			var index = remaining++
			writestream.on('close', function(file) {
				files[index] = file
				remaining--
				respond()
			})
			file.pipe(writestream)
		})
		busboy.on('finish', function() {
			finished = true
			respond()
		})

		req.pipe(busboy)

		function respond() {
			if(!remaining && finished) {
				res.json(files.map(f => f._id))
				files.forEach(generateMeta)
			}
		}
	}

	function updateMeta(req, res, next) {

	}

	function generateMeta(file) {
		var metadata = file.metadata || {}
		var filestream = gfs.createReadStream({ _id:file._id })
		var remaining = 0

		var handled = options.handlers.some(handler => {
			if(!handler.meta) return
			if(!handler.mime.test(file.contentType)) return

			remaining++
			handler.meta(filestream, metadata, complete)
		})

		if(!handled && ++remaining) complete()

		function complete(err) {
			if(err) console.error(err)
			if(!--remaining) gfs.files.updateOne({ _id:file._id }, { $set:{ metadata } }, (err) => {
				if(err) console.error(err)
			})
		}
	}

}

var allowedMethods = [
	'blur',
	'charcoal',
	'colorize',
	'colors',
	'contrast',
	'despeckle',
	'dither',
	'edge',
	'emboss',
	'enhance',
	'equalize',
	'flip',
	'flop',
	'fuzz',
	'gamma',
	'implode',
	'level',
	'modulate',
	'monochrome',
	'negate',
	'noise',
	'normalize',

]