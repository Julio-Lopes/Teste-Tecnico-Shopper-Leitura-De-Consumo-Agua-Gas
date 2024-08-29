import { model, Schema, Document } from "mongoose";

interface IClient extends Document {
  image: string;
  customer_code: string;
  measure_datetime: Date;
  measure_type: 'WATER' | 'GAS';
  measure_value: Number;
  has_confirmed: Boolean;
  measure_uuid: string;
}

const clientSchema = new Schema<IClient>(
  {
    image: { type: String, required: true },
    customer_code: { type: String, required: true },
    measure_datetime: { type: Date, required: true }, 
    measure_type: { type: String, enum: ['WATER', 'GAS'], required: true },
    measure_value: { type: Number, required: true },
    has_confirmed: { type: Boolean, required: false }
  },
  {
    timestamps: true,
  }
);

const Client = model<IClient>("client", clientSchema);

export default Client;