import http from 'http';
import express from 'express';
import bodyParser from 'body-parser';
import mongoose from 'mongoose';
import { register, confirmMeasurement, listMeasurements } from './controller/ClientController';
import 'dotenv/config';
import multer, { MulterError } from 'multer';

const { MONGODB_URL } = process.env as { [key: string]: string };

mongoose.connection.on('connected', () => console.log('Mongoose is connected'));
mongoose.connection.on('error', (err: Error) => console.error(err));
mongoose.connect(MONGODB_URL);

const app = express();

const upload = multer({dest: './src/images'});

app.use(bodyParser.json());

app.route('/upload')
    .post(upload.single('image'), register);

app.route('/confirm')
    .patch(confirmMeasurement);

app.route('/:customer_code/list')
    .get(listMeasurements);

const server = http.createServer(app)

server.listen(3000, () => console.log('Servidor rodando na porta %s.', 3000))