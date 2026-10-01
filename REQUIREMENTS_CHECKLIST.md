# REQUIREMENTS CHECKLIST

來源：`docs/ORIGINAL_REQUIREMENTS.txt`（完整保存使用者提示詞）。
勾選僅代表已實作並驗證。可選功能與條件功能仍需明確說明結果；不得當作無条件必須功能或默默省略。

目前：已讀完全文、Git已初始化、環境檢查中。

## 流程與環境

- [ ] R001 閱讀完整原文，保存需求來源，逐項清單與最終驗收
- [ ] R002 工作目錄正確；自主處理非關鍵決策、不依賴使用者確認
- [ ] R003 實際可執行、互動、展示的完整作品，不能只有骨架或文件
- [ ] R004 檢查 Unity、Hub、版本、WebGL與桌面模組
- [ ] R005 檢查 Blender、Python/bpy與建模流程
- [ ] R006 檢查 Git、LFS、gh、remote與登入狀態
- [ ] R007 檢查 Python、Conda、Node、npm/pnpm、.NET、VS/Build Tools
- [ ] R008 檢查 FFmpeg、Ollama、LM Studio、相容端點、GPU/CUDA、本地模型、其他引擎
- [ ] R009 按完成能力、視覺、穩定、展示、Web部署、擴充選棧；避免不必要微服務

## 核心與角色

- [ ] R010 AI Survival Society：AI Agent、湧現行為、視覺模擬、互動、可觀察決策
- [ ] R011 12 個可辨識且在世界內實際自主移動的 Agent
- [ ] R012 每名角色 Name、HP、Hunger、Energy、Inventory、Weapon、Goal
- [ ] R013 八項 0–1 personality：aggression、greed、loyalty、empathy、riskTolerance、sociability、deception、curiosity
- [ ] R014 角色具有需求、目標、記憶、關係、資源、trust、fear、hostility
- [ ] R015 探索、生存、交流、合作、交易、結盟
- [ ] R016 欺騙、偷竊、攻擊、逃跑、背叛
- [ ] R017 行為由人格與狀態產生，禁止固定劇本或單純大量敵人 if-attack
- [ ] R018 社會形成、變化、瓦解；完整跑一局觀察合作、衝突、結盟、背叛

## AI與模型

- [ ] R019 Utility AI 結合 personality、relationships、memory、environment
- [ ] R020 LLM 僅高階決策、dialogue、reflection、story，非每幀查詢
- [ ] R021 provider、endpoint、model、temperature 放入設定而非寫死
- [ ] R022 沒有 LLM 時完整使用 Utility fallback
- [ ] R023 非阻塞 async、queue、timeout、fallback
- [ ] R024 Structured schema：action、target、message、public_reason
- [ ] R025 只展示簡短公開理由，不展示隱藏推理
- [ ] R026 JSON驗證、動作白名單、目標合法性、值域限制、無效回覆fallback
- [ ] R027 模型不能執行 shell 或檔案操作，只能決定允許模擬動作
- [ ] R028 client與provider解耦，Local Ollama／Remote compatible／Fallback adapter
- [ ] R029 API key 僅server/env，不存在 client；.env.example 只有變數名

## 記憶與關係

- [ ] R030 記憶 Who、What、When、Importance、Emotional Impact
- [ ] R031 重要事件影響 trust、affinity、fear、hostility
- [ ] R032 Social graph：friendship、alliance、hostility
- [ ] R033 Graph 綠正向、藍結盟、紅敵意，隨資料即時更新

## 世界與視覺

- [ ] R034 3D stylized low-poly island，有 forest、river、ruins、village、mountain、supply area
- [ ] R035 Modern、stylized、clean、futuristic、dark simulation dashboard
- [ ] R036 統一色彩、角色輪廓/頭形/配件/符號，避免預設灰UI或只有文字
- [ ] R037 lighting、postprocessing、camera、fog、particles、animation提升完成度
- [ ] R038 程序生成地形、樹、岩石、建築，不手工巨大地圖
- [ ] R039 Blender若使用：Art／Blender／Exports、保留blend與glb/fbx
- [ ] R040 Blender generate_assets.py 可重建程序資產
- [ ] R041 Orbit、pan、zoom、點擊focus
- [ ] R042 Follow Agent camera
- [ ] R043 核心完成後 cinematic：fight/betrayal/death/final短暫focus且不干擾模擬
- [ ] R044 核心完成後可選 ambient/UI/combat/event audio

## Director與安全區

- [ ] R045 Director只改環境，不直接控制角色
- [ ] R046 Food Crisis：食物生成減少70%
- [ ] R047 Supply Drop：中央稀有資源
- [ ] R048 Storm：移速降低
- [ ] R049 Rumor：所有Agent收到某角色藏食物傳聞
- [ ] R050 Treasure：稀有物資
- [ ] R051 Plague：部分Agent持续HP下降
- [ ] R052 逐漸收縮安全區，迫使互動

## 事件與UI

- [ ] R053 重要事件全進Event Bus
- [ ] R054 RESOURCE_FOUND、TRADE、CONVERSATION、ALLIANCE_CREATED、ALLIANCE_BROKEN
- [ ] R055 BETRAYAL、ATTACK、ESCAPE、DEATH、SUPPLY_DROP事件
- [ ] R056 LIVE WORLD FEED有時間、actor/target、對話與重要事件
- [ ] R057 點選角色Inspector：portrait/name/HP/hunger/energy/inventory/weapon/goal
- [ ] R058 Inspector：八項personality/relationships/important memories
- [ ] R059 CURRENT DECISION：goal、observed、decision、public reason
- [ ] R060 Dashboard alive/deaths/kills/trades/alliances/betrayals/average trust
- [ ] R061 Most trusted/feared/aggressive/social由simulation資料計算
- [ ] R062 Start、pause、resume、restart、speed正常
- [ ] R063 Winner最後一人與存活時間/kills/trades/alliances/betrayals統計
- [ ] R064 零存活時有合理結果且可重新運行

## 紀錄與重現

- [ ] R065 Random seed可重現測試
- [ ] R066 logs／saves／config目錄
- [ ] R067 JSON event含 timestamp、actor、target、event、position、result、relationship_change
- [ ] R068 完整event log可輸出與儲存
- [ ] R069 AI Historian依整局log產生history，LLM可用則模型，否則template
- [ ] R070 可選Replay至少讀取一局timeline/stats/major events
- [ ] R071 可反覆啟動停止重開，持續執行且避免無界記憶體成長

## 建置與部署

- [ ] R072 至少Desktop Development Build可執行
- [ ] R073 合理時Web build；環境失敗不得犧牲desktop
- [ ] R074 Web-ready架構，保留server-side remote AI adapter
- [ ] R075 成功Web輸出置web或合理部署目錄
- [ ] R076 安全且無機密才公開部署（未必必須公開）
- [ ] R077 模組化Core/Simulation/AI/Memory/Relationships/World/Events/Combat/UI/Director/Persistence/LLM

## Git與安全

- [ ] R078 從開始使用Git，正確gitignore
- [ ] R079 排除cache/temp/log/build垃圾/model weights/secrets，保留sources/config
- [ ] R080 Blender大檔評估Git LFS
- [ ] R081 階段性清楚commits，不只最後一筆
- [ ] R082 commit前檢查status、秘密、cache、大檔
- [ ] R083 existing remote優先；gh登入且有權限則create private repo/push
- [ ] R084 禁止token/password/API key/secret加入Git
- [ ] R085 無登入時完成local，不破解認證、不等待半夜回覆
- [ ] R086 最後commit、clean status、push後確認remote branch

## 文件與展示

- [ ] R087 README hero title/description/features/screenshots
- [ ] R088 README architecture/how it works/AI architecture
- [ ] R089 README installation/run/Unity version或非Unity说明/optional LLM/Web version
- [ ] R090 README controls/director/project structure/future work
- [ ] R091 數張真實Demo screenshot放docs/images並在README顯示
- [ ] R092 screenshot overview/inspector/relationship/director/final result（可行時）
- [ ] R093 可選GIF/MP4：moving/relationship/fight/director
- [ ] R094 FINAL_REPORT.md：what/stack/architecture/features/Blender/AI/LLM
- [ ] R095 FINAL_REPORT.md：run/build/web/Git/GitHub/limitations/improvements
- [ ] R096 報告準確標註COMPLETED、PARTIAL、NOT IMPLEMENTED

## QA與完成

- [ ] R097 每重要功能實際執行，遇錯讀log修正重跑
- [ ] R098 測試Start/Pause/Resume/Restart/Speed/Selection/Movement
- [ ] R099 測試Resource/Conversation/Relationship/Alliance/Combat/Death
- [ ] R100 測試Safe zone/Director/End game/Log/無LLM執行
- [ ] R101 最後至少完整跑一局，多seed驗證不同互動並調整utility非劇本
- [ ] R102 Polish spacing/typography/camera/lighting/materials/animation/transitions/colors/feedback/hierarchy
- [ ] R103 逐條核對原文後半段與Completion Definition、Finalization、Final report
- [ ] R104 另一個人依README可啟動；最終成果是可操作完成品

## 驗收證據

依階段在此加入執行結果；最終狀態對照 FINAL_REPORT.md 與 docs/QA_REPORT.md。
