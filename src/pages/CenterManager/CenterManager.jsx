import '../../style/CenterManager/CenterManager.css'

export default function CenterManager() {
  return (
    <main className="center-manager">
      <section className="center-manager__header">
        <div>
          <p className="center-manager__eyebrow">QUẢN LÝ TRUNG TÂM</p>
          <h1>Chào mừng đến với Center Manager</h1>
          <p>Quản lý hoạt động của trung tâm thể thao tại một nơi.</p>
        </div>
        <button type="button">+ Thêm sân mới</button>
      </section>

      <section className="center-manager__stats" aria-label="Thống kê trung tâm">
        <article>
          <span>Tổng số sân</span>
          <strong>12</strong>
        </article>
        <article>
          <span>Lịch đặt hôm nay</span>
          <strong>28</strong>
        </article>
        <article>
          <span>Hội viên</span>
          <strong>156</strong>
        </article>
      </section>
    </main>
  )
}
