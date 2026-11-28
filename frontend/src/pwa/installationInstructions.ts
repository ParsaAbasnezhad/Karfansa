export type ManualInstallMethod = 'ios-safari' | 'browser-menu' | 'unavailable'

export function manualInstallMethod(): ManualInstallMethod {
  const ua = navigator.userAgent
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isIosSafari = isIos && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)

  if (isIosSafari) return 'ios-safari'
  if (!isIos && /Android/i.test(ua)) return 'browser-menu'
  return 'unavailable'
}

export function installationInstructions() {
  const method = manualInstallMethod()
  if (method === 'ios-safari') {
    return {
      title: 'نصب کارفنسا در آیفون و آیپد',
      description: 'برای افزودن کارفنسا به صفحه اصلی دستگاه:',
      steps: [
        'گزینه اشتراک‌گذاری را انتخاب کنید.',
        'گزینه Add to Home Screen را بزنید.',
        'گزینه Add را انتخاب کنید.',
      ],
    }
  }

  if (method === 'browser-menu') {
    return {
      title: 'نصب کارفنسا',
      description:
        'منوی مرورگر را باز کنید و اگر گزینه نصب در دسترس است، Install app یا Add to Home screen را انتخاب کنید.',
      steps: [],
    }
  }

  return {
    title: 'دسترسی به اپلیکیشن کارفنسا',
    description:
      'نصب مستقیم در این لحظه از طریق این مرورگر در دسترس نیست. اگر گزینه نصب یا افزودن به صفحه اصلی در منوی مرورگر نمایش داده شد، می‌توانید از آن استفاده کنید.',
    steps: [],
  }
}
