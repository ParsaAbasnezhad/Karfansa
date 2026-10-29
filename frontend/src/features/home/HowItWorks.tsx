const steps = [
  {
    title: 'اول خود کارفنسا',
    text: 'شرکت‌های ثبت‌شده و تأییدشده‌ی کارفنسا جست‌وجو می‌شوند و همیشه بالاتر از بقیه می‌آیند.',
  },
  {
    title: 'بعد منابع دیگر',
    text: 'اگر نتیجه‌ی کافی پیدا نشد، منابع دیگر هم بررسی می‌شوند. این نتایج جدا و با برچسب تأییدنشده نمایش داده می‌شوند.',
  },
  {
    title: 'منبع و تاریخ کنار هر نتیجه',
    text: 'هر اطلاعات نشان می‌دهد از کجا آمده و کی دریافت شده، تا خودتان درباره‌ی اعتبارش قضاوت کنید.',
  },
]

export function HowItWorks() {
  return (
    <section className="section" id="how" aria-labelledby="how-title">
      <div className="container">
        <h2 className="section__title" id="how-title">
          چطور کار می‌کند
        </h2>
        <ol className="steps">
          {steps.map((step) => (
            <li className="steps__item" key={step.title}>
              <h3 className="steps__title">{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
