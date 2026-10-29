/**
 * An annotated SAMPLE of how results will look. It is deliberately labelled as sample data:
 * the border style is the information (solid = verified member, dashed = found on the web).
 */
export function ResultAnatomy() {
  return (
    <aside className="anatomy" aria-label="نمونه‌ی نمایش نتیجه‌ها">
      <p className="anatomy__note">نمونه‌ی نمایشی برای توضیح ظاهر نتیجه‌ها. داده‌ی واقعی نیست.</p>
      <p className="anatomy__query">
        جست‌وجو برای <strong>زعفران</strong>
      </p>

      <section className="result" aria-labelledby="group-member">
        <h2 className="result__group" id="group-member">
          عضو کارفنسا و تأییدشده
        </h2>
        <article className="result__item result__item--member">
          <span className="seal" aria-hidden="true">
            <svg viewBox="0 0 16 16">
              <path d="M3.5 8.5l3 3 6-6.5" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </span>
          <h3 className="result__name">شرکت نمونه‌ی الف</h3>
          <ul className="facts">
            <li>تولیدکننده</li>
            <li>خراسان رضوی</li>
          </ul>
          <p className="result__source">اطلاعات را خود شرکت اعلام کرده است.</p>
        </article>
      </section>

      <section className="result" aria-labelledby="group-web">
        <h2 className="result__group" id="group-web">
          یافته‌شده از وب و تأییدنشده
        </h2>
        <article className="result__item result__item--web">
          <h3 className="result__name">شرکت نمونه‌ی ب</h3>
          <p className="result__source">
            منبع: <bdi dir="ltr">example.com/saffron</bdi>
            <br />
            دریافت‌شده در ۴ آبان ۱۴۰۵
          </p>
        </article>
      </section>
    </aside>
  )
}
