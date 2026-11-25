document.addEventListener("DOMContentLoaded", () => {
  const dataNode = document.getElementById("ka-dashboard-data");
  if (!dataNode || typeof Chart === "undefined") return;

  const data = JSON.parse(dataNode.textContent || "{}");
  const palette = ["#209a68", "#e0a533", "#d65349", "#64748b", "#7c5ac2", "#2d91a0"];
  const shared = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 220 },
    plugins: {
      legend: { labels: { usePointStyle: true, boxWidth: 8, font: { family: "Vazirmatn" } } },
      tooltip: { titleFont: { family: "Vazirmatn" }, bodyFont: { family: "Vazirmatn" } },
    },
  };
  const chartOptions = {
    users: {
      type: "line",
      datasets: [{ label: "ثبت‌نام", borderColor: palette[0], backgroundColor: "#209a6820", fill: true, tension: 0.25 }],
    },
    companies: {
      type: "line",
      datasets: [{ label: "شرکت", borderColor: palette[5], backgroundColor: "#2d91a020", fill: true, tension: 0.25 }],
    },
    product_status: {
      type: "doughnut",
      datasets: [{ label: "محصول", backgroundColor: palette }],
    },
    opportunity_categories: {
      type: "bar",
      datasets: [{ label: "فرصت تجاری", backgroundColor: palette[0], borderRadius: 5 }],
      options: { indexAxis: "y" },
    },
    reviews: {
      type: "line",
      datasets: [
        { label: "تأیید", borderColor: palette[0], backgroundColor: "#209a6820", fill: true, tension: 0.25 },
        { label: "رد", borderColor: palette[2], backgroundColor: "#d6534920", fill: true, tension: 0.25 },
      ],
    },
    provinces: {
      type: "bar",
      datasets: [{ label: "کسب‌وکار", backgroundColor: palette[0], borderRadius: 5 }],
      options: { indexAxis: "y" },
    },
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const canvas = entry.target;
        const key = canvas.dataset.chart;
        const series = data[key];
        const config = chartOptions[key];
        if (!series || !config) continue;

        const datasets = config.datasets.map((dataset, index) => ({
          ...dataset,
          data: key === "reviews"
            ? index === 0 ? series.approved : series.rejected
            : series.values,
        }));
        new Chart(canvas, {
          type: config.type,
          data: { labels: series.labels, datasets },
          options: {
            ...shared,
            ...config.options,
            scales: config.type === "line" || config.type === "bar"
              ? { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 } } }
              : undefined,
          },
        });
        observer.unobserve(canvas);
      }
    },
    { rootMargin: "100px" },
  );

  document.querySelectorAll("canvas[data-chart]").forEach((canvas) => observer.observe(canvas));
});
