import React from 'react'

export type Language = 'en' | 'ku' | 'ar'
export type Direction = 'ltr' | 'rtl'

type TranslationValue = string | ((params: Record<string, string>) => string)

type Translations = Record<string, TranslationValue>

const translations: Record<Language, Translations> = {
  en: {
    languageLabel: 'Language',
    languageEnglish: 'English',
    languageKurdish: 'Kurdish',
    languageArabic: 'Arabic',
    brandTitle: 'Live Gold Monitor',
    brandSub: 'Live Gold Monitor & Tools',
    tutorialVideo: 'Tutorial Video',
    openTutorialAria: 'Open tutorial video notice',
    installApp: 'Install app',
    localPriceUpdate: 'Local price update',
    sinceLastMarketMove: 'Since last market move:',
    timeHourShort: 'h',
    timeMinuteShort: 'm',
    timeSecondShort: 's',
    installModalTitle: 'Install on Android',
    installModalText:
      'If the popup does not appear automatically, open your browser menu and tap Install app / Add to Home screen. This app is already configured as a PWA and works offline after install.',
    close: 'Close',
    footerNote:
      'Optimized for fast, reliable access. Price history is continuously saved and kept up to date automatically.',
    usageNoticeTitle: 'User Notice and Usage Agreement — Please Read Carefully',
    usageNoticeP1:
      'Before using this tool, you are strongly advised to watch the official tutorial video. The video explains how the calculator works, how to enter values correctly, and how to interpret the results. Using the tool without understanding the instructions may lead to incorrect assumptions.',
    usageNoticeP2:
      'This website is NOT affiliated with, approved by, or connected to any official gold authority, government body, or jewelers’ syndicate (including the Kurdistan Jewelers Syndicate / Gold Traders Association). The page does not use official local pricing feeds. Live gold ounce prices are obtained from global market data providers, and all other values shown by the tools are automated calculations.',
    usageNoticeP3Intro: 'The platform includes tools for:',
    usageNoticeList1:
      'Converting live ounce prices into local karat values based on weight (including 5-gram / mithqal style calculations)',
    usageNoticeList2:
      'Estimating margins or local add-on charges typically applied by market regulators or local trade practice (user-entered or slider-based estimates, not official fees)',
    usageNoticeList3: 'Price expectation scenarios for educational planning purposes',
    usageNoticeP4:
      'USD to IQD conversion inside the calculator is based on the value of 1 USD to IQD exchange rate — not bulk or 100-unit bank rates — unless explicitly stated otherwise.',
    usageNoticeP5:
      'All calculations, margins, expectations, and conversion outputs are estimates for informational and educational use only. They are not official quotes, not trading offers, and not certified jeweler prices. Users must verify all numbers with a licensed jeweler or authorized gold trader before making any buying, selling, or financial decision.',
    usageNoticeP6:
      'By continuing to use this page, you acknowledge and agree that you understand these limitations, accept full responsibility for your use of the results, and agree that the website owner is not liable for any loss, pricing difference, transaction outcome, or decision made based on the displayed data.',
    usageNoticeCheckbox:
      'confirm that I have watched the tutorial video, understand that all prices and calculations shown are informational estimates only, that this platform is not affiliated with any government or jewelers’ authority, and I accept full responsibility for how I use the results.',
    confirm: 'Confirm',
    infoNoticeTitle: 'User Notice — Please Read',
    infoNoticeText:
      'Please watch the short tutorial video before using these tools. This platform provides live global gold ounce prices and automated calculators for karat conversion, local margin estimates, expectation scenarios, and USD-to-IQD conversion (based on 1 USD rate). It is not connected to any government authority or jewelers’ syndicate and does not provide official local jeweler prices. All values are informational estimates only and may differ from licensed jeweler quotes. Always verify prices and calculations with an authorized jeweler before making any buying or selling decision. By continuing to use this page, you accept responsibility for how you use the results.',
    playTutorialAria: 'Play tutorial video',
    videoUnsupported: 'Your browser does not support the video tag.',
    watchAgain: 'Watch again',
    liveGoldTitle: 'Live Gold (XAU)',
    perOunce: 'per ounce',
    today: 'Today',
    days30: '30 Days',
    months6: '6 Months',
    year1: '1 Year',
    years5: '5 Years',
    years20: '20 Years',
    showsChangeSinceMidnight: 'Shows change since 12:00 AM local time.',
    connectionTitle: 'Connection',
    online: 'Online',
    offline: 'Offline',
    latency: 'Latency',
    download: 'Download',
    quality: 'Quality',
    recheck: 'Recheck',
    connectionNote:
      'Note: If your internet connection is slow or offline, price updates may be delayed. Live prices are fetched automatically from our data provider.',
    qualityVeryLow: 'Very Low',
    qualityLow: 'Low',
    qualityGood: 'Good',
    qualityStrong: 'Strong',
    expectationTitle: 'Expectation',
    whatIfCalculator: 'What-if calculator',
    expectedOuncePrice: 'Expected ounce price',
    placeholderExpectedOunce: 'e.g. 4900.50',
    hintExpectedOunce: 'Write your expected XAU (USD per ounce).',
    usdToIqd: 'USD → IQD',
    placeholderUsdToIqd: 'e.g. 1500',
    hintIfFilledResultIqd: 'If filled, result is IQD.',
    mithqal: 'Mithqal (5g)',
    gram: 'Gram',
    includesMargin: ({ value }) => `Includes margin: ${value} IQD`,
    addUsdToIqdEnableMargin: 'Add USD→IQD to enable IQD margin slider.',
    expectationMargin: 'Expectation margin (IQD)',
    enableByEnteringUsdToIqd: 'Enable by entering USD→IQD',
    karatsTitle: 'Karats',
    leaveEmptyForUsd: 'Leave empty for USD',
    karatsHint: 'Enter a value to convert karat prices to IQD. The live ounce price remains in USD.',
    waiting: 'waiting…',
    marginTax: 'Margin / Tax (IQD)',
    sliderWorksNote: 'Slider works for IQD-only karat prices. Ounce is unaffected.',
    taxMarginSolveTitle: 'Tax / Margin Solve',
    autoSyncSlider: 'Auto sync slider',
    localOuncePriceUsd: 'Local ounce price (USD)',
    localOuncePlaceholder: 'e.g. 4900',
    localOunceHint: 'The gold ounce price you saw locally.',
    usdToIqdHint: 'Dollar price in IQD.',
    local21PerMithqal: 'Local 21K per mithqal',
    local21Placeholder: 'e.g. 450,000',
    local21Hint: 'The 21k mithqal price you saw locally (IQD).',
    theoretical21k: 'Theoretical 21K mithqal',
    marginResult: 'Margin result',
    applyMarginMainSlider: 'Apply margin to main slider',
    marginSolveNote:
      'Calculates the margin for 21K mithqal based on your inputs and updates the main margin slider automatically.',
    advancedCalculator: 'Advanced Calculator',
    showHistory: 'Show history',
    hideHistory: 'Hide history',
    history: 'History',
    clear: 'Clear',
    noHistoryYet: 'No history yet.',
    calcError: 'Error',
    calcTipDivide: 'Tip: use ÷ for division.',
    feedbackTitle: 'Feedback / Suggestions',
    feedbackSub: 'Share ideas or report issues',
    nameOptional: 'Name (optional)',
    emailOptional: 'Email (optional)',
    messageLabel: 'Message *',
    messageRequired: 'Message is required.',
    emailInvalid: 'Enter a valid email address.',
    fixHighlightedFields: 'Please fix the highlighted fields.',
    sentThankYou: 'Sent. Thank you!',
    unableToSend: 'Unable to send right now. Please try again.',
    sendFeedback: 'Send feedback',
    sending: 'Sending...',
    feedbackWebsiteLabel: 'Website',
    historyChartTitle: 'History Chart',
    range24h: '24H',
    range7d: '7 Days',
    rangeMonths: 'Months',
    rangeYears: 'Years',
    backToLive: 'Back to Live',
    resetZoom: 'Reset zoom',
    loading: 'Loading…',
    failedToLoadHistory: 'Failed to load history',
    errorPrefix: ({ message }) => `Error: ${message}`,
    lastLabel: ({ price, time }) => `Last: ${price} @ ${time}`,
    noDataYet: 'No data yet',
    chartHelp:
      'Desktop: wheel zooms, left-drag pans (x-axis), middle-drag pans freely, Alt holds precision crosshair. Mobile: drag to pan, pinch to zoom, long-press for crosshair, double-tap to reset.',
    goldLabel: 'Gold',
    staleLabel: 'No price change > 5 min',
  },
  ku: {
    languageLabel: 'زمان',
    languageEnglish: 'ئینگلیزی',
    languageKurdish: 'کوردی',
    languageArabic: 'عەرەبی',
    brandTitle: 'چاودێری زێڕی ڕاستەوخۆ',
    brandSub: 'چاودێری زێڕی ڕاستەوخۆ و ئامرەزەکان',
    tutorialVideo: 'ڤیدیۆی فێرکاری',
    openTutorialAria: 'کردنەوەی ئاگاداری ڤیدیۆی فێرکاری',
    installApp: 'دابەزاندنی ئەپ',
    localPriceUpdate: 'نوێکردنەوەی نرخی ناوخۆ',
    sinceLastMarketMove: 'لە دوای دوایین جوڵەی بازاڕ:',
    timeHourShort: 'ک',
    timeMinuteShort: 'خ',
    timeSecondShort: 'چ',
    installModalTitle: 'دامەزراندن لە ئاندروید',
    installModalText:
      'ئەگەر پۆپەکە خۆکارانە دەربکەوێت نا، مێنیوی وێبگەڕکەت بکەرەوە و لەسەر Install app / Add to Home screen کلیک بکە. ئەم ئەپە وەک PWA ڕێکخراوە و دوای دامەزراندن بە بێ ئینتەرنێتیش کار دەکات.',
    close: 'داخستن',
    footerNote:
      'بۆ دەستڕاگەیشتنی خێرا و باوەڕپێکراو ڕێکخراوە. مێژووی نرخ بەردەوام هەڵگیراوە و خۆکارانە نوێ دەکرێتەوە.',
    usageNoticeTitle: 'ئاگاداری بەکارهێنان و ڕێکەوتن — تکایە بە وردی بخوێنەوە',
    usageNoticeP1:
      'پێش بەکارهێنانی ئەم ئامرازە، بە بەردەوامی پێشنیار دەکرێت ڤیدیۆی فێرکاری فەرمی ببینیت. ئەم ڤیدیۆیە شێوازی کارکردنی حیسابکەر، چۆن نوسینی نرخەکان بە دروستی، و چۆن تێگەیشتن لە ئەنجامەکان ڕوون دەکاتەوە. بەکارهێنانی ئامرازەکە بە بێ تێگەیشتن لە ڕێنماییەکان دەکرێت بۆ تێڕوانینی هەڵە.',
    usageNoticeP2:
      'ئەم ماڵپەڕە هیچ پەیوەندیێکی نیە بە هیچ دەزگای فەرمی زێڕ، دەزگای حکومەتی، یان سندیکای جواهره‌فروش (لەوانە سندیکای جواهرەفروشی کوردستان / یەکێتی بازرگانانی زێڕ). ئەم پەڕەیە نرخە فەرمیە ناوخۆیی بەکار ناهێنێت. نرخی ئۆنسەی زێڕی ڕاستەوخۆ لە داتای بازاڕی جیهانیەوە وەردەگیرێت، و هەموو بەرهەمەکان بە شێوەی خۆکارانە حیساب دەکرێن.',
    usageNoticeP3Intro: 'ئەم پلاتفۆمە ئامرازەکانی خوارەوە لەخۆ دەگرێت:',
    usageNoticeList1:
      'گۆڕینی نرخی ئۆنسەی ڕاستەوخۆ بۆ نرخی عەیارەکان بە بنەمای کێش (لەوانە حیسابەکانی ٥ گرام / مثقال)',
    usageNoticeList2:
      'پێشبینی زیادەی گومرگ یان زیادەی ناوخۆیی کە زۆرجار لەلایەن ڕێکخەرە بازاڕییەکان یان بازرگانی ناوخۆ دەکرێت (هەڵبژاردەی بەکارهێنەر یان سلایدەر، نە نرخی فەرمی)',
    usageNoticeList3: 'سناریۆی پێشبینی نرخ بۆ ئامادەکاری فێربوون',
    usageNoticeP4:
      'گۆڕینی USD بۆ IQD لە ناو حیسابکەرەکە بە بنەمای نرخی ١ USD بۆ IQD دەکرێت — نە نرخی بانکی کۆمەڵایەتی یان ١٠٠-یەکان — مەگەر بە ڕوونی باس کرابێت.',
    usageNoticeP5:
      'هەموو حیسابکردنەکان، زیادەکان، پێشبینیەکان، و گۆڕینی نرخی دراوەکان تەنها بۆ زانیاری و فێربوونە. ئەوان نرخی فەرمی نین، پێشنیاری بازاڕگانی نین، و نرخی جواهرەفروشی پشتڕاستکراو نین. بەکارهێنەران دەبێت هەموو ژمارەکان لەگەڵ جواهرەفروشی مۆڵەتدار یان بازرگانی زێڕ پشتڕاست بکەن پێش هەر بڕیارێکی کڕین، فرۆشتن، یان دارایی.',
    usageNoticeP6:
      'بە بەردەوام بوون لە بەکارهێنانی ئەم پەڕەیە، تۆ دانی پێدەنیت کە ئەم سنووردارانە تێدەگەیت، بەرپرسیاریت بۆ بەکارهێنانی ئەنجامەکان قبووڵ دەکەیت، و دەستەواژەکە دەکات کە خاوەن ماڵپەڕ بەرپرسیار نیە لە هیچ زیان، جیاوازی نرخ، ئەنجامی مامەڵە، یان بڕیارێک کە لەسەر بنەمای داتای پیشان دراوە بکرێت.',
    usageNoticeCheckbox:
      'دڵنیابوونەوەی دڵنیام کە ڤیدیۆی فێرکاریەم بینیوە، تێدەگەم کە هەموو نرخ و حیسابەکان تەنها بۆ زانیارییە، ئەم پلاتفۆمە هیچ پەیوەندیێکی نیە بە هیچ دەزگای حکومەتی یان سندیکای جواهرەفروشی، و بەرپرسیاری تەواوی بەکارهێنانی ئەنجامەکان دەگرم.',
    confirm: 'پشتڕاستکردنەوە',
    infoNoticeTitle: 'ئاگاداری بەکارهێنانی — تکایە بخوێنەوە',
    infoNoticeText:
      'تکایە پێش بەکارهێنانی ئەم ئامرازانە ڤیدیۆی فێرکاریی کورت ببینە. ئەم پلاتفۆمە نرخی ئۆنسەی زێڕی ڕاستەوخۆی جیهانی و حیسابکەرە خۆکارەکان بۆ گۆڕینی عەیارەکان، پێشبینی زیادەی ناوخۆ، سناریۆی پێشبینی، و گۆڕینی USD بۆ IQD (بە بنەمای نرخی ١ USD) دابین دەکات. هیچ پەیوەندیێکی نیە بە هیچ دەزگای حکومەتی یان سندیکای جواهرەفروشی و نرخی فەرمی ناوخۆیی دابین ناکات. هەموو بەرهەمەکان تەنها بۆ زانیارییە و لەوانە جیاوازیان هەبێت لە نرخی جواهرەفروشی مۆڵەتدار. هەمیشە پێش هەر بڕیارێکی کڕین/فرۆشتن نرخ و حیسابەکان پشتڕاست بکە. بە بەردەوام بوون لە بەکارهێنانی ئەم پەڕەیە، تۆ بەرپرسیاری بەکارهێنانی ئەنجامەکان قبووڵ دەکەیت.',
    playTutorialAria: 'لێدانی ڤیدیۆی فێرکاری',
    videoUnsupported: 'وێبگەڕەکەت پشتگیری ڤیدیۆ ناکات.',
    watchAgain: 'دوبارە ببینەوە',
    liveGoldTitle: 'زێڕی ڕاستەوخۆ (XAU)',
    perOunce: 'بۆ هەر ئۆنسەیەک',
    today: 'ئەمڕۆ',
    days30: '٣٠ ڕۆژ',
    months6: '٦ مانگ',
    year1: '١ ساڵ',
    years5: '٥ ساڵ',
    years20: '٢٠ ساڵ',
    showsChangeSinceMidnight: 'گۆڕانەکان لە کاتژمێر 12:00ی شەوەوە پیشان دەدرێن.',
    connectionTitle: 'پەیوەندی',
    online: 'ڕاستەوخۆ',
    offline: 'دەرهێڵ',
    latency: 'دواخستن',
    download: 'داگرتن',
    quality: 'کوالێتی',
    recheck: 'دووبارە پشکنین',
    connectionNote:
      'تێبینی: ئەگەر پەیوەندی ئینتەرنێتت لاواز بوو یان پچرا بێت، نوێکردنەوەی نرخەکان لەوانەیە دوا بکەون. نرخە ڕاستەوخۆکان خۆکارانە نوێ دەبنەوە.',
    qualityVeryLow: 'زۆر لاواز',
    qualityLow: 'لاواز',
    qualityGood: 'باش',
    qualityStrong: 'بەهێز',
    expectationTitle: 'پێشبینی',
    whatIfCalculator: 'هەژمارکردنی پێشبینی ئۆنسە',
    expectedOuncePrice: 'نرخی پێشبینی ئۆنسە',
    placeholderExpectedOunce: 'وەک نمونە 4900.50',
    hintExpectedOunce: 'نرخی پێشبینی XAU (USD بۆ هەر ئۆنسە) بنوسە.',
    usdToIqd: 'USD → IQD',
    placeholderUsdToIqd: 'وەک نمونە 1500',
    hintIfFilledResultIqd: 'ئەگەر نووسرا، ئەنجام بە IQD دەبێت.',
    mithqal: 'مثقال (٥ گرام)',
    gram: 'گرام',
    includesMargin: ({ value }) => `لەخۆگرتنی زیادە: ${value} IQD`,
    addUsdToIqdEnableMargin: 'USD→IQD زیاد بکە بۆ چالاککردنی سلایدەری زیادەی IQD.',
    expectationMargin: 'پێشبینی باج (IQD)',
    enableByEnteringUsdToIqd: 'بە نووسینی USD→IQD چالاک دەبێت',
    karatsTitle: 'عەیارەکان',
    leaveEmptyForUsd: 'بەتاڵ بهێڵە بۆ USD',
    karatsHint: 'بەهایەک بنوسە بۆ گۆڕینی نرخی عەیارەکان بۆ IQD. نرخی ئۆنسە ڕاستەوخۆ لە USD دەماوێتەوە.',
    waiting: 'چاوەڕوانی…',
    marginTax: 'زیادە / باج (IQD)',
    sliderWorksNote: 'سلایدەر تەنها بۆ نرخی عەیارەکانی IQD کار دەکات. ئۆنسە کاریگەر نیە.',
    taxMarginSolveTitle: 'دەرکردنی باجی ئەمرۆ',
    autoSyncSlider: 'هاوڕێکخستنی خۆکار',
    localOuncePriceUsd: 'نرخی ئۆنسە لە ناوخۆ (USD)',
    localOuncePlaceholder: 'وەک نمونە 4900',
    localOunceHint: 'نرخی ئۆنسەی زێڕ کە لە ناوخۆ دیتوتە.',
    usdToIqdHint: 'نرخی دۆلار بە IQD.',
    local21PerMithqal: 'نرخی ٢١قەرات بۆ مثقال',
    local21Placeholder: 'وەک نمونە 450,000',
    local21Hint: 'نرخی مثقالی ٢١قەرات کە لە ناوخۆ دیتوتە (IQD).',
    theoretical21k: 'نرخی تیۆری ٢١قەرات مثقال',
    marginResult: 'ئەنجامی زیادە',
    applyMarginMainSlider: 'زیادە لە سلایدەری سەرەکی جێگیر بکە',
    marginSolveNote:
      'زیادەی مثقالی ٢١قەرات بە بنەمای زانیارییەکانت حیساب دەکات و سلایدەری زیادەی سەرەکی خۆکارانە نوێ دەکاتەوە.',
    advancedCalculator: 'حاسیبە',
    showHistory: 'مێژوو پیشان بدە',
    hideHistory: 'مێژوو بشارەوە',
    history: 'مێژوو',
    clear: 'پاککردنەوە',
    noHistoryYet: 'هێشتا مێژوو نیە.',
    calcError: 'هەڵە',
    calcTipDivide: 'ئامۆژگاری: بۆ دابەشکردن ÷ بەکاربهێنە.',
    feedbackTitle: 'فیدباک / پێشنیار',
    feedbackSub: 'پێشنیار بۆ ئەم پەیجە بنووسە',
    nameOptional: 'ناو (ئارەزوومەند)',
    emailOptional: 'ئیمەیڵ (ئارەزوومەند)',
    messageLabel: 'نامە *',
    messageRequired: 'نامە پێویستە.',
    emailInvalid: 'تکایە ئیمەیڵێکی دروست بنووسە.',
    fixHighlightedFields: 'تکایە خانە دیاریکراوەکان چاک بکە.',
    sentThankYou: 'نێردرا. سوپاس!',
    unableToSend: 'لە ئێستادا ناتوانرێت بنێردرێت. تکایە دواتر هەوڵ بدە.',
    sendFeedback: 'ناردنی فیدباک',
    sending: 'ناردن…',
    feedbackWebsiteLabel: 'ماڵپەڕ',
    historyChartTitle: 'چارتەی مێژوو',
    range24h: '٢٤ کاتژمێر',
    range7d: '٧ ڕۆژ',
    rangeMonths: 'مانگەکان',
    rangeYears: 'ساڵانە',
    backToLive: 'گەڕانەوە بۆ ڕاستەوخۆ',
    resetZoom: 'ڕێکخستنەوەی بینین',
    loading: 'بارکردن…',
    failedToLoadHistory: 'نەتوانرا مێژوو باربکرێت',
    errorPrefix: ({ message }) => `هەڵە: ${message}`,
    lastLabel: ({ price, time }) => `دوایین نوێکاری: ${price} @ ${time}`,
    noDataYet: 'هێشتا داتا نیە',
    chartHelp:
      'دیسک‌تاپ: ویل زووم دەکات، ڕاکێشانی چەپ پان دەکات (محوری x)، ڕاکێشانی ناوەڕاست ئازاد پان دەکات، Alt کراسهەیرە پڕەوە دەهێڵێت. مۆبایل: ڕاکێشان بۆ پان، پینچ بۆ زووم، درێژ-فشاردن بۆ کراسهەیر، دوو-تاپ بۆ ڕێکخستنەوە.',
    goldLabel: 'زێڕ',
    staleLabel: 'گۆڕانی نرخ > ٥ خولەک نیە',
  },
  ar: {
    languageLabel: 'اللغة',
    languageEnglish: 'الإنجليزية',
    languageKurdish: 'الكردية',
    languageArabic: 'العربية',
    brandTitle: 'مراقبة الذهب المباشرة',
    brandSub: 'مراقبة الذهب المباشرة والأدوات',
    tutorialVideo: 'فيديو الشرح',
    openTutorialAria: 'فتح تنبيه فيديو الشرح',
    installApp: 'تثبيت التطبيق',
    localPriceUpdate: 'تحديث السعر المحلي',
    sinceLastMarketMove: 'منذ آخر حركة في السوق:',
    timeHourShort: 'س',
    timeMinuteShort: 'د',
    timeSecondShort: 'ث',
    installModalTitle: 'التثبيت على أندرويد',
    installModalText:
      'إذا لم تظهر النافذة المنبثقة تلقائيًا، افتح قائمة المتصفح واضغط تثبيت التطبيق / إضافة إلى الشاشة الرئيسية. هذا التطبيق مُعد كـ PWA ويعمل دون اتصال بعد التثبيت.',
    close: 'إغلاق',
    footerNote:
      'محسّن للوصول السريع والموثوق. يتم حفظ سجل الأسعار باستمرار وتحديثه تلقائيًا.',
    usageNoticeTitle: 'تنبيه المستخدم واتفاقية الاستخدام — يرجى القراءة بعناية',
    usageNoticeP1:
      'قبل استخدام هذه الأداة، يُنصح بشدة بمشاهدة فيديو الشرح الرسمي. يوضح الفيديو كيفية عمل الآلة الحاسبة، وكيفية إدخال القيم بشكل صحيح، وكيفية تفسير النتائج. استخدام الأداة دون فهم التعليمات قد يؤدي إلى افتراضات غير صحيحة.',
    usageNoticeP2:
      'هذا الموقع غير تابع لأي جهة رسمية للذهب أو جهة حكومية أو نقابة الصاغة (بما في ذلك نقابة صياغة الذهب في كردستان / جمعية تجار الذهب). ولا يستخدم الموقع تغذية أسعار محلية رسمية. يتم جلب أسعار أونصة الذهب المباشرة من مزودي بيانات السوق العالمية، وجميع القيم الأخرى المعروضة هي حسابات آلية.',
    usageNoticeP3Intro: 'تتضمن المنصة أدوات لـ:',
    usageNoticeList1:
      'تحويل سعر الأونصة المباشر إلى قيم العيارات المحلية حسب الوزن (بما في ذلك حسابات 5 غرام / مثقال)',
    usageNoticeList2:
      'تقدير الهوامش أو الإضافات المحلية التي تُطبق عادةً من قبل الجهات المنظمة أو الممارسات المحلية (تقديرات يدخلها المستخدم أو عبر شريط تمرير، وليست رسومًا رسمية)',
    usageNoticeList3: 'سيناريوهات توقع الأسعار لأغراض التخطيط التعليمي',
    usageNoticeP4:
      'التحويل من USD إلى IQD داخل الحاسبة يعتمد على قيمة 1 USD إلى IQD — وليس أسعار البنوك بالجملة أو 100 وحدة — ما لم يُذكر خلاف ذلك صراحةً.',
    usageNoticeP5:
      'جميع الحسابات والهوامش والتوقعات ونتائج التحويل هي تقديرات لأغراض معلوماتية وتعليمية فقط. ليست أسعارًا رسمية، ولا عروضًا للتداول، ولا أسعارًا معتمدة لدى الصاغة. يجب على المستخدمين التحقق من جميع الأرقام مع صائغ مرخص أو تاجر ذهب معتمد قبل أي قرار شراء أو بيع أو قرار مالي.',
    usageNoticeP6:
      'بمواصلة استخدام هذه الصفحة، فإنك تقر وتوافق على أنك تفهم هذه القيود، وتتحمل المسؤولية الكاملة عن استخدامك للنتائج، وتوافق على أن مالك الموقع غير مسؤول عن أي خسارة أو فرق سعر أو نتيجة معاملة أو قرار مبني على البيانات المعروضة.',
    usageNoticeCheckbox:
      'أؤكد أنني شاهدت فيديو الشرح، وأفهم أن جميع الأسعار والحسابات المعروضة هي تقديرات معلوماتية فقط، وأن هذه المنصة غير مرتبطة بأي جهة حكومية أو نقابة صاغة، وأتحمل المسؤولية الكاملة عن كيفية استخدام النتائج.',
    confirm: 'تأكيد',
    infoNoticeTitle: 'تنبيه المستخدم — يرجى القراءة',
    infoNoticeText:
      'يرجى مشاهدة فيديو الشرح القصير قبل استخدام هذه الأدوات. توفر هذه المنصة أسعار أونصة الذهب العالمية المباشرة وآلات حاسبة آلية لتحويل العيارات، وتقدير الهوامش المحلية، وسيناريوهات التوقع، والتحويل من USD إلى IQD (على أساس سعر 1 USD). وهي غير مرتبطة بأي جهة حكومية أو نقابة صاغة ولا توفر أسعارًا محلية رسمية. جميع القيم تقديرات معلوماتية فقط وقد تختلف عن أسعار الصاغة المعتمدين. تحقق دائمًا من الأسعار والحسابات مع صائغ معتمد قبل أي قرار شراء أو بيع. بمواصلة استخدام هذه الصفحة، فإنك تتحمل مسؤولية استخدام النتائج.',
    playTutorialAria: 'تشغيل فيديو الشرح',
    videoUnsupported: 'متصفحك لا يدعم عنصر الفيديو.',
    watchAgain: 'شاهد مرة أخرى',
    liveGoldTitle: 'الذهب المباشر (XAU)',
    perOunce: 'لكل أونصة',
    today: 'اليوم',
    days30: '30 يومًا',
    months6: '6 أشهر',
    year1: 'سنة واحدة',
    years5: '5 سنوات',
    years20: '20 سنة',
    showsChangeSinceMidnight: 'يعرض التغير منذ الساعة 12:00 منتصف الليل بالتوقيت المحلي.',
    connectionTitle: 'الاتصال',
    online: 'متصل',
    offline: 'غير متصل',
    latency: 'زمن الاستجابة',
    download: 'التنزيل',
    quality: 'الجودة',
    recheck: 'إعادة الفحص',
    connectionNote:
      'ملاحظة: إذا كان اتصال الإنترنت لديك بطيئًا أو غير متصل، فقد تتأخر تحديثات الأسعار. يتم جلب الأسعار المباشرة تلقائيًا من مزود البيانات.',
    qualityVeryLow: 'منخفض جدًا',
    qualityLow: 'منخفض',
    qualityGood: 'جيد',
    qualityStrong: 'قوي',
    expectationTitle: 'التوقع',
    whatIfCalculator: 'حاسبة ماذا لو',
    expectedOuncePrice: 'سعر الأونصة المتوقع',
    placeholderExpectedOunce: 'مثال 4900.50',
    hintExpectedOunce: 'اكتب السعر المتوقع لـ XAU (USD لكل أونصة).',
    usdToIqd: 'USD → IQD',
    placeholderUsdToIqd: 'مثال 1500',
    hintIfFilledResultIqd: 'عند الإدخال ستكون النتيجة بالدينار.',
    mithqal: 'مثقال (5غ)',
    gram: 'غرام',
    includesMargin: ({ value }) => `يشمل الهامش: ${value} IQD`,
    addUsdToIqdEnableMargin: 'أضف USD→IQD لتفعيل شريط هامش IQD.',
    expectationMargin: 'هامش التوقع (IQD)',
    enableByEnteringUsdToIqd: 'يُفعّل بإدخال USD→IQD',
    karatsTitle: 'العيارات',
    leaveEmptyForUsd: 'اتركه فارغًا لـ USD',
    karatsHint: 'أدخل قيمة لتحويل أسعار العيارات إلى IQD. يبقى سعر الأونصة المباشر بـ USD.',
    waiting: 'جارٍ الانتظار…',
    marginTax: 'الهامش / الضريبة (IQD)',
    sliderWorksNote: 'شريط التمرير يعمل لأسعار العيارات بـ IQD فقط. الأونصة غير متأثرة.',
    taxMarginSolveTitle: 'حل الضريبة / الهامش',
    autoSyncSlider: 'مزامنة تلقائية للشريط',
    localOuncePriceUsd: 'سعر الأونصة المحلي (USD)',
    localOuncePlaceholder: 'مثال 4900',
    localOunceHint: 'سعر أونصة الذهب الذي رأيته محليًا.',
    usdToIqdHint: 'سعر الدولار بالدينار.',
    local21PerMithqal: 'سعر 21 قيراط لكل مثقال',
    local21Placeholder: 'مثال 450,000',
    local21Hint: 'سعر مثقال 21 قيراط الذي رأيته محليًا (IQD).',
    theoretical21k: 'سعر مثقال 21 قيراط النظري',
    marginResult: 'نتيجة الهامش',
    applyMarginMainSlider: 'تطبيق الهامش على الشريط الرئيسي',
    marginSolveNote:
      'يحسب الهامش لمثقال 21 قيراط بناءً على مدخلاتك ويحدّث شريط الهامش الرئيسي تلقائيًا.',
    advancedCalculator: 'آلة حاسبة متقدمة',
    showHistory: 'إظهار السجل',
    hideHistory: 'إخفاء السجل',
    history: 'السجل',
    clear: 'مسح',
    noHistoryYet: 'لا يوجد سجل بعد.',
    calcError: 'خطأ',
    calcTipDivide: 'نصيحة: استخدم ÷ للقسمة.',
    feedbackTitle: 'ملاحظات / اقتراحات',
    feedbackSub: 'شارك الأفكار أو أبلغ عن المشاكل',
    nameOptional: 'الاسم (اختياري)',
    emailOptional: 'البريد الإلكتروني (اختياري)',
    messageLabel: 'الرسالة *',
    messageRequired: 'الرسالة مطلوبة.',
    emailInvalid: 'أدخل بريدًا إلكترونيًا صالحًا.',
    fixHighlightedFields: 'يرجى إصلاح الحقول المحددة.',
    sentThankYou: 'تم الإرسال. شكرًا لك!',
    unableToSend: 'يتعذر الإرسال الآن. يرجى المحاولة لاحقًا.',
    sendFeedback: 'إرسال الملاحظات',
    sending: 'جارٍ الإرسال…',
    feedbackWebsiteLabel: 'الموقع',
    historyChartTitle: 'مخطط السجل',
    range24h: '24 ساعة',
    range7d: '7 أيام',
    rangeMonths: 'أشهر',
    rangeYears: 'سنوات',
    backToLive: 'العودة للمباشر',
    resetZoom: 'إعادة الضبط',
    loading: 'جارٍ التحميل…',
    failedToLoadHistory: 'تعذر تحميل السجل',
    errorPrefix: ({ message }) => `خطأ: ${message}`,
    lastLabel: ({ price, time }) => `آخر: ${price} @ ${time}`,
    noDataYet: 'لا توجد بيانات بعد',
    chartHelp:
      'سطح المكتب: عجلة الماوس للتكبير، والسحب بالزر الأيسر للتحريك (محور x)، والسحب بالزر الأوسط للتحريك الحر، وAlt لإظهار مؤشر الدقة. الهاتف: السحب للتحريك، والقرص للتكبير، والضغط المطوّل لإظهار المؤشر، والنقر المزدوج لإعادة الضبط.',
    goldLabel: 'الذهب',
    staleLabel: 'لا تغيير في السعر > 5 دقائق',
  },
}

export const LANGUAGE_OPTIONS: { value: Language; label: string }[] = [
  { value: 'ku', label: 'کوردی' },
  { value: 'ar', label: 'العربية' },
  { value: 'en', label: 'English' },
]

export type TranslationKey = keyof typeof translations.en

export type Translate = (key: TranslationKey, params?: Record<string, string>) => string

export function createTranslator(lang: Language): Translate {
  return (key, params = {}) => {
    const entry = translations[lang][key] ?? translations.en[key]
    if (!entry) return key
    if (typeof entry === 'function') return entry(params)
    return entry
  }
}

export function getDirection(lang: Language): Direction {
  return lang === 'en' ? 'ltr' : 'rtl'
}

export function normalizeLanguage(value: unknown): Language {
  if (value === 'en' || value === 'ku' || value === 'ar') return value
  return 'ku'
}

export type I18nContextValue = {
  lang: Language
  dir: Direction
  t: Translate
  setLanguage: (lang: Language) => void
}

export const I18nContext = React.createContext<I18nContextValue | null>(null)

export function useI18n() {
  const ctx = React.useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nContext')
  return ctx
}
