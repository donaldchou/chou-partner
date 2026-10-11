import { Schema } from "mongoose";
import { BRANDS } from "@/lib/enums";
import { defineModel, money, required, str, sub } from "./_shared";

const PriceSchema = new Schema({ season: { type: Number, required: true }, listPrice: money, salePrice: money }, sub);

/** 產品規格；_id 是產品代碼（BO-N003、KA-N008、PEACH-08…），價格依產季保存 */
const ProductSchema = new Schema({
  _id: required("產品代碼"),
  brand: { type: String, enum: BRANDS, default: "" },
  category: required("品項"),
  name: required("產品名稱"),
  spec: str,
  pieces: { type: Number, min: 0 },
  weight: str,
  description: str,
  prices: { type: [PriceSchema], default: [] },
  active: { type: Boolean, default: true },
});

export const ProductModel = defineModel("Product", ProductSchema, "products");
