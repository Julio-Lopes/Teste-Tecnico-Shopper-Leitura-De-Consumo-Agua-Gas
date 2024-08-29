import { Request, Response } from 'express';
import Client from '../model/Client';
import { GoogleGenerativeAI } from "@google/generative-ai";
import path from 'path';
import fs from 'fs';
import multer, { MulterError } from 'multer';
import 'dotenv/config';

function fileToGenerativePart(path: string, mimeType: string) {
    return {
        inlineData: {
            data: Buffer.from(fs.readFileSync(path)).toString("base64"),
            mimeType
        }
    }
}

const register = async (req: Request, res: Response) => {
    const { customer_code, measure_datetime, measure_type } = req.body;
    const file = req.file;

    if (!file) {
        return res.status(400).json({
            error_code: "INVALID_DATA",
            error_description: "Nenhum arquivo foi enviado."
        });
    }

    if (!['WATER', 'GAS'].includes(measure_type)) {
        return res.status(400).json({
            error_code: "INVALID_DATA",
            error_description: "Tipo de medição não permitida. Os valores permitidos são WATER ou GAS."
        });
    }

    const tempPath = file.path;
    const targetPath = path.join(__dirname, "../images/" + file.originalname);

    try {
        await fs.promises.rename(tempPath, targetPath);

        const imagePart = [
            fileToGenerativePart(targetPath, "image/jpg")
        ];

        const { GEMINI_API_KEY } = process.env as { [key: string]: string };
        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = "return for me just the numbers in the meter";

        const result = await model.generateContent([prompt, ...imagePart]);
        const response = await result.response;
        const text = await response.text();
        const measure_value = parseInt(text); 

        const existingClient = await Client.findOne({
            customer_code,
            measure_type,
            measure_datetime: {
                $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) 
            }
        });

        if (existingClient) {
            return res.status(409).json({
                error_code: "DOUBLE_REPORT",
                error_description: "Leitura do mês já realizada"
            });
        }

        const client = new Client({
            image: Buffer.from(fs.readFileSync(targetPath)).toString("base64"),
            customer_code,
            measure_datetime: new Date(),
            measure_type,
            measure_value,
            has_confirmed: false
        });

        await client.save();

        return res.status(200).json({
            image_url: `/images/${file.originalname}`,
            measure_value: measure_value,
            measure_uuid: client.id
        });
    } catch (error: any) {
        console.error('Erro durante a execução:', error);
        return res.status(500).json({
            error_code: "INTERNAL_ERROR",
            error_description: error.message || error.toString()
        });
    }
}

const confirmMeasurement = async (req: Request, res: Response) => {
    const { measure_uuid, confirmed_value } = req.body;

    if (!measure_uuid || typeof confirmed_value !== 'number') {
        return res.status(400).json({
            error_code: "INVALID_DATA",
            error_description: "Parâmetros inválidos. O campo 'measure_uuid' deve ser uma string e 'confirmed_value' deve ser um número."
        });
    }

    try {
        const measurement = await Client.findById(measure_uuid);

        if (!measurement) {
            return res.status(404).json({
                error_code: "MEASURE_NOT_FOUND",
                error_description: "Leitura não encontrada."
            });
        }

        if (measurement.has_confirmed == true) {
            return res.status(409).json({
                error_code: "CONFIRMATION_DUPLICATE",
                error_description: "Leitura já confirmada."
            });
        }

        measurement.measure_value = confirmed_value;
        measurement.has_confirmed = true;
        await measurement.save();

        return res.status(200).json({
            success: true
        });
    } catch (error: any) {
        console.error('Erro durante a confirmação:', error);
        return res.status(500).json({
            error_code: "INTERNAL_ERROR",
            error_description: error.message || error.toString()
        });
    }
};

const listMeasurements = async (req: Request, res: Response) => {
    const { customer_code } = req.params;
    const { measure_type } = req.query;

    if (measure_type && !['WATER', 'GAS'].includes(String(measure_type).toUpperCase())) {
        return res.status(400).json({
            error_code: "INVALID_TYPE",
            error_description: "Tipo de medição não permitida. Os valores permitidos são WATER ou GAS."
        });
    }

    try {
        const filter: any = { customer_code };

        if (measure_type) {
            filter.measure_type = String(measure_type).toUpperCase();
        }

        const measures = await Client.find(filter);

        if (!measures || measures.length === 0) {
            return res.status(404).json({
                error_code: "MEASURES_NOT_FOUND",
                error_description: "Nenhuma leitura encontrada."
            });
        }
        
        const response = {
            customer_code,
            measures: measures.map(measure => ({
                measure_uuid: measure.id.toString(),
                measure_datetime: measure.measure_datetime,
                measure_type: measure.measure_type,
                has_confirmed: measure.has_confirmed,
                image_url: `/images/${measure.image}`
            }))
        };

        return res.status(200).json(response);
    } catch (error: any) {
        console.error('Erro ao listar medidas:', error);
        return res.status(500).json({
            error_code: "INTERNAL_ERROR",
            error_description: error.message || error.toString()
        });
    }
};

export { register, confirmMeasurement, listMeasurements };
