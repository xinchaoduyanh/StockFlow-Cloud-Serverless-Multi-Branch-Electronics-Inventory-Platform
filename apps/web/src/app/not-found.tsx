import Link from "next/link";
import { BrandMark } from "@/components/BrandLogo";

export default function NotFound() {
  return (
    <main className="app-background grid place-items-center px-6 py-16" id="main">
      <section className="content-layer grid max-w-md justify-items-start gap-6">
        <BrandMark className="h-12 w-12" />
        <div className="grid gap-3">
          <p className="code m-0 text-sm text-[var(--color-accent-solid)]">Lỗi 404</p>
          <h1 className="m-0 font-display text-4xl font-semibold leading-tight tracking-tight">
            Không có linh kiện nào ở địa chỉ này.
          </h1>
          <p className="m-0 text-sm leading-relaxed text-[var(--color-text-secondary)]">
            Trang bạn tìm đã bị chuyển đi hoặc chưa từng tồn tại. Quay lại bảng điều khiển để tiếp
            tục làm việc.
          </p>
        </div>
        <Link className="button-primary" href="/dashboard">
          Về bảng điều khiển
        </Link>
      </section>
    </main>
  );
}
