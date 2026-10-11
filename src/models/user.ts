import { Schema } from "mongoose";
import { defineModel, idField } from "./_shared";

export const USER_ROLES = ["admin", "user"] as const;

/** 登入帳號：管理者可以修改資料與使用後台；一般使用者只能看 */
const UserSchema = new Schema(
  {
    _id: idField,
    email: {
      type: String,
      required: [true, "請填寫 Email"] as [true, string],
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Email 格式不正確"] as [RegExp, string],
    },
    name: { type: String, default: "", trim: true },
    /** bcrypt 雜湊，絕不回傳給前端 */
    passwordHash: { type: String, required: true },
    role: { type: String, enum: USER_ROLES, default: "user" },
    active: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);
UserSchema.index({ email: 1 }, { unique: true });

export const UserModel = defineModel("User", UserSchema, "users");
