# 現有 GitHub 倉庫公開驗收

目標：直接將 oliverchenOVO/ai-survival-society 從 Private 改為 Public，保留原始演進紀錄。使用者於 2026-10-04 明確確認倉庫名稱；實際既有 tags 為 v1.0.0 至 v1.7.0。

- [x] 核對本機／遠端 main 與實際 tags，保存變更前 metadata。
- [x] 檢查完整可達歷史中的常見憑證格式；不將匹配內容輸出到公開資料。
- [x] 加入自有程式與素材的權利保留聲明，保留第三方與 GitHub 平台權利。
- [x] 更新 README 的當前存取方式，保留歷史報告與 gameplay。
- [x] 直接變更同一個 repository 的 visibility，不重建、不刪除歷史。
- [x] 核對 repository ID、原有 commit／tags／Releases／asset IDs 及 Actions 紀錄。
- [x] 確認 public main、README 與 Release 可公開讀取。
文件推送仍須通過原有 required pre-push checks；本清單核對的是可見性變更與既有紀錄，文件新增提交不覆寫原 commit。

Stars／forks 的變更前數量均為 0；公開後可能自然變動，核對時記錄實際數量。原始憑證掃描及 metadata 位於忽略的 .qa/public-visibility/；此掃描是常見格式檢查，不保證識別所有敏感內容。這次不刪除先前的展示倉庫。

實際驗證：同一 repository ID 1400647153 已為 PUBLIC，全部既有 refs 未變、7 則 Releases 與資產 IDs／digests 未變、Actions runs 維持 0，stars／forks 維持 0。441 個歷史文字 blobs 的常見憑證掃描僅找到兩版同一個 credential-redaction 測試假資料，已人工核對，無未處理匹配。匿名 README 讀取成功。
