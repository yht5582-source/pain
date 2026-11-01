# 急診急性疼痛｜互動治療決策導航

線上版：https://yht5582-source.github.io/pain/

依 **EUSEM 2025 Guidelines for the management of acute pain in emergency situations** 製作的急診止痛決策輔助（單一 `index.html`，不儲存或傳送資料）。

- 疼痛分級：輕度 NRS <4、中度 4–6、重度 7–10（Figure 8.2）
- 安全篩選：腎（AKI／eGFR／透析）、肝、出血、心血管、脫水、妊娠、NSAID 過敏、已用 NSAID／opioid
- 多模式止痛：成人 Figure 8.3a、兒童 Figure 8.3b 逐層疊加；病因導向重點（骨折、腎絞痛、腹痛、頭痛、腰背痛、牙痛、神經病變性）
- 成人起始劑量參考（第 8 章）：paracetamol（≥50 kg 依 EUSEM；<50 kg 依台灣仿單 15 mg/kg q6h 或 12.5 mg/kg q4h、每日 ≤75 mg/kg；肝病 ≤2 g）、ketamine、fentanyl、morphine
- 特殊族群（第 7 章）、重大創傷（NICE NG39 1.7.4–1.7.6）
- 無法自述 NRS 時的評量表（按鈕開啟、逐項點選計分）：FACES（自繪示意臉譜）、FLACC、CRIES、PAINAD、CPOT（插管／未插管）、BPS／BPS-NI；0–10 量表可帶入初始分級或複評，CRIES／CPOT／BPS 依原始切點判讀並記錄至摘要
- 複評（Figure 8.1）：依嚴重度與給藥途徑決定時間；改善 ≥30% 視為具臨床意義（第 3 章）
- 6 組示範病例（一般骨折、透析、高齡出血、妊娠腎絞痛、失代償肝硬化、進階失智 PAINAD），一鍵帶入
- 診斷與治療心智圖：左評估、右處置，預設收合為總覽，點分支展開；手機改單欄，來自台灣仿單的項目另行標示
- 測驗 20 題：基礎 10＋高階 10（多重限制、資料衝突、計算陷阱），交卷後顯示解析；可只作單一題組

## 開發

決策邏輯集中於 `index.html` 內 `/*ENGINE-START*/ … /*ENGINE-END*/` 區塊。
示範病例在 `/*CASES-START*/ …`，題庫在 `/*QUIZ-START*/ …`，心智圖在 `/*MAP-START*/ …`；`tests.cjs` 會把每題答案與病例說明對照引擎結果。

```
node tests.cjs
```

臨床決策輔助原型，不可直接作為醫囑；藥品選用須符合當地仿單與院內規範。
