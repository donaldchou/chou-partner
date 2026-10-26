import { Schema } from "mongoose";
import { defineModel, idField } from "./_shared";

/** 系統設定，一種設定一筆：_id "pageAccess" = 一般使用者可以看的頁面 */
const SettingSchema = new Schema(
  {
    _id: idField,
    allowed: { type: [String], default: undefined },
  },
  { timestamps: true },
);

export const SettingModel = defineModel("Setting", SettingSchema, "settings");
