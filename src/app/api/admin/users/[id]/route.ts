import { NextResponse, type NextRequest } from "next/server";
import { handleError, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { deleteUser, updateUser } from "@/lib/admin-users";

type Ctx = RouteContext<"/api/admin/users/[id]">;

/** PATCH /api/admin/users/<id> { name?, role?, active?, password? } */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const me = await requireAdmin();
    return NextResponse.json(await updateUser((await ctx.params).id, await readJson(req), me));
  } catch (err) {
    return handleError(err);
  }
}

/** DELETE /api/admin/users/<id>（不能刪自己，至少保留一位管理者） */
export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const me = await requireAdmin();
    await deleteUser((await ctx.params).id, me);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleError(err);
  }
}
