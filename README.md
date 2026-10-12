# 急診急性疼痛｜互動治療決策導航

線上版：https://yht5582-source.github.io/pain/

依 **EUSEM 2025 Guidelines for the management of acute pain in emergency situations** 製作的急診止痛決策輔助（單一 `index.html`，不儲存或傳送資料）。

- 疼痛分級：輕度 NRS <4、中度 4–6、重度 7–10（Figure 8.2）
- 安全篩選：腎（AKI／eGFR／透析）、肝、出血、心血管、脫水、妊娠、NSAID 過敏、已用 NSAID／opioid
- 多模式止痛：成人 Figure 8.3a、兒童 Figure 8.3b 逐層疊加；病因導向重點（骨折、腎絞痛、腹痛、頭痛、腰背痛、牙痛、神經病變性）
- 成人起始劑量參考（第 8 章）：paracetamol（依體重／肝病上限）、ketamine、fentanyl、morphine
- 特殊族群（第 7 章）、重大創傷（NICE NG39 1.7.4–1.7.6）
- 複評（Figure 8.1）：依嚴重度與給藥途徑決定時間；改善 ≥30% 視為具臨床意義（第 3 章）

## 開發

決策邏輯集中於 `index.html` 內 `/*ENGINE-START*/ … /*ENGINE-END*/` 區塊。

```
node tests.cjs
```

臨床決策輔助原型，不可直接作為醫囑；藥品選用須符合當地仿單與院內規範。
