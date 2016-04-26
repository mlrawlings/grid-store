var express = require('express')
var store = require('..')
var mongoose = require('mongoose')
var app = express()

mongoose.connect('mongodb://localhost/grid-store-test')

app.use('/uploads', store({ mongoose }))

app.get('/', function(req, res, next) {
	res.send(`
		<!doctype html>
		<html>
		<head>
		</head>
		<body>
			<form action="/uploads" method="POST" enctype="multipart/form-data">
				<input type="file" name="whatever" multiple />
				<input type="submit" value="upload" />
			</form>
		</body>
		</html>
	`)
})

app.listen(9999)