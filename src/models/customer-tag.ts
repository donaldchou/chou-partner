import { Schema } from "mongoose";
import { defineModel, required } from "./_shared";

/** 客戶標籤選項（回頭客、買多、獅子會…），在「標籤管理」新增、改名、排序 */
const CustomerTagSchema = new Schema({
  _id: { type: String, required: true },
  name: required("標籤名稱"),
  order: { type: Number, default: 0 },
});

export const CustomerTagModel = defineModel("CustomerTag", CustomerTagSchema, "customerTags");
