# REQUIREMENTS CHECKLIST

來源：`docs/ORIGINAL_REQUIREMENTS.txt`（完整保存使用者提示詞）。
勾選僅代表已實作並驗證。可選功能與條件功能仍需明確說明結果；不得當作無条件必須功能或默默省略。

原始版本驗收保留於下方；本次 v1.4 的逐項驗收見本文末尾與 docs/V1.4_REPORT.md。未公開部署、crawler 圖片 metadata 與可選功能均明列限制。

## 流程與環境

- [x] R001 閱讀完整原文，保存需求來源，逐項清單與最終驗收
- [x] R002 工作目錄正確；自主處理非關鍵決策、不依賴使用者確認
- [x] R003 實際可執行、互動、展示的完整作品，不能只有骨架或文件
- [x] R004 檢查 Unity、Hub、版本、WebGL與桌面模組
- [x] R005 檢查 Blender、Python/bpy與建模流程
- [x] R006 檢查 Git、LFS、gh、remote與登入狀態
- [x] R007 檢查 Python、Conda、Node、npm/pnpm、.NET、VS/Build Tools
- [x] R008 檢查 FFmpeg、Ollama、LM Studio、相容端點、GPU/CUDA、本地模型、其他引擎
- [x] R009 按完成能力、視覺、穩定、展示、Web部署、擴充選棧；避免不必要微服務

## 核心與角色

- [x] R010 AI Survival Society：AI Agent、湧現行為、視覺模擬、互動、可觀察決策
- [x] R011 12 個可辨識且在世界內實際自主移動的 Agent
- [x] R012 每名角色 Name、HP、Hunger、Energy、Inventory、Weapon、Goal
- [x] R013 八項 0–1 personality：aggression、greed、loyalty、empathy、riskTolerance、sociability、deception、curiosity
- [x] R014 角色具有需求、目標、記憶、關係、資源、trust、fear、hostility
- [x] R015 探索、生存、交流、合作、交易、結盟
- [x] R016 欺騙、偷竊、攻擊、逃跑、背叛
- [x] R017 行為由人格與狀態產生，禁止固定劇本或單純大量敵人 if-attack
- [x] R018 社會形成、變化、瓦解；完整跑一局觀察合作、衝突、結盟、背叛

## AI與模型

- [x] R019 Utility AI 結合 personality、relationships、memory、environment
- [x] R020 LLM 僅高階決策、dialogue、reflection、story，非每幀查詢
- [x] R021 provider、endpoint、model、temperature 放入設定而非寫死
- [x] R022 沒有 LLM 時完整使用 Utility fallback
- [x] R023 非阻塞 async、queue、timeout、fallback
- [x] R024 Structured schema：action、target、message、public_reason
- [x] R025 只展示簡短公開理由，不展示隱藏推理
- [x] R026 JSON驗證、動作白名單、目標合法性、值域限制、無效回覆fallback
- [x] R027 模型不能執行 shell 或檔案操作，只能決定允許模擬動作
- [x] R028 client與provider解耦，Local Ollama／Remote compatible／Fallback adapter
- [x] R029 API key 僅server/env，不存在 client；.env.example 只有變數名

## 記憶與關係

- [x] R030 記憶 Who、What、When、Importance、Emotional Impact
- [x] R031 重要事件影響 trust、affinity、fear、hostility
- [x] R032 Social graph：friendship、alliance、hostility
- [x] R033 Graph 綠正向、藍結盟、紅敵意，隨資料即時更新

## 世界與視覺

- [x] R034 3D stylized low-poly island，有 forest、river、ruins、village、mountain、supply area
- [x] R035 Modern、stylized、clean、futuristic、dark simulation dashboard
- [x] R036 統一色彩、角色輪廓/頭形/配件/符號，避免預設灰UI或只有文字
- [x] R037 lighting、postprocessing、camera、fog、particles、animation提升完成度
- [x] R038 程序生成地形、樹、岩石、建築，不手工巨大地圖
- [x] R039 Blender若使用：Art／Blender／Exports、保留blend與glb/fbx
- [x] R040 Blender generate_assets.py 可重建程序資產
- [x] R041 Orbit、pan、zoom、點擊focus
- [x] R042 Follow Agent camera
- [x] R043 核心完成後 cinematic：fight/betrayal/death/final短暫focus且不干擾模擬
- [x] R044 核心完成後可選 ambient/UI/combat/event audio

## Director與安全區

- [x] R045 Director只改環境，不直接控制角色
- [x] R046 Food Crisis：食物生成減少70%
- [x] R047 Supply Drop：中央稀有資源
- [x] R048 Storm：移速降低
- [x] R049 Rumor：所有Agent收到某角色藏食物傳聞
- [x] R050 Treasure：稀有物資
- [x] R051 Plague：部分Agent持续HP下降
- [x] R052 逐漸收縮安全區，迫使互動

## 事件與UI

- [x] R053 重要事件全進Event Bus
- [x] R054 RESOURCE_FOUND、TRADE、CONVERSATION、ALLIANCE_CREATED、ALLIANCE_BROKEN
- [x] R055 BETRAYAL、ATTACK、ESCAPE、DEATH、SUPPLY_DROP事件
- [x] R056 LIVE WORLD FEED有時間、actor/target、對話與重要事件
- [x] R057 點選角色Inspector：portrait/name/HP/hunger/energy/inventory/weapon/goal
- [x] R058 Inspector：八項personality/relationships/important memories
- [x] R059 CURRENT DECISION：goal、observed、decision、public reason
- [x] R060 Dashboard alive/deaths/kills/trades/alliances/betrayals/average trust
- [x] R061 Most trusted/feared/aggressive/social由simulation資料計算
- [x] R062 Start、pause、resume、restart、speed正常
- [x] R063 Winner最後一人與存活時間/kills/trades/alliances/betrayals統計
- [x] R064 零存活時有合理結果且可重新運行

## 紀錄與重現

- [x] R065 Random seed可重現測試
- [x] R066 logs／saves／config目錄
- [x] R067 JSON event含 timestamp、actor、target、event、position、result、relationship_change
- [x] R068 完整event log可輸出與儲存
- [x] R069 AI Historian依整局log產生history，LLM可用則模型，否則template
- [x] R070 可選Replay至少讀取一局timeline/stats/major events
- [x] R071 可反覆啟動停止重開，持續執行且避免無界記憶體成長

## 建置與部署

- [x] R072 至少Desktop Development Build可執行
- [x] R073 合理時Web build；環境失敗不得犧牲desktop
- [x] R074 Web-ready架構，保留server-side remote AI adapter
- [x] R075 成功Web輸出置web或合理部署目錄
- [x] R076 安全且無機密才公開部署（未必必須公開）
- [x] R077 模組化Core/Simulation/AI/Memory/Relationships/World/Events/Combat/UI/Director/Persistence/LLM

## Git與安全

- [x] R078 從開始使用Git，正確gitignore
- [x] R079 排除cache/temp/log/build垃圾/model weights/secrets，保留sources/config
- [x] R080 Blender大檔評估Git LFS
- [x] R081 階段性清楚commits，不只最後一筆
- [x] R082 commit前檢查status、秘密、cache、大檔
- [x] R083 existing remote優先；gh登入且有權限則create private repo/push
- [x] R084 禁止token/password/API key/secret加入Git
- [x] R085 無登入時完成local，不破解認證、不等待半夜回覆
- [x] R086 最後commit、clean status、push後確認remote branch

## 文件與展示

- [x] R087 README hero title/description/features/screenshots
- [x] R088 README architecture/how it works/AI architecture
- [x] R089 README installation/run/Unity version或非Unity说明/optional LLM/Web version
- [x] R090 README controls/director/project structure/future work
- [x] R091 數張真實Demo screenshot放docs/images並在README顯示
- [x] R092 screenshot overview/inspector/relationship/director/final result（可行時）
- [x] R093 可選GIF/MP4：moving/relationship/fight/director
- [x] R094 FINAL_REPORT.md：what/stack/architecture/features/Blender/AI/LLM
- [x] R095 FINAL_REPORT.md：run/build/web/Git/GitHub/limitations/improvements
- [x] R096 報告準確標註COMPLETED、PARTIAL、NOT IMPLEMENTED

## QA與完成

- [x] R097 每重要功能實際執行，遇錯讀log修正重跑
- [x] R098 測試Start/Pause/Resume/Restart/Speed/Selection/Movement
- [x] R099 測試Resource/Conversation/Relationship/Alliance/Combat/Death
- [x] R100 測試Safe zone/Director/End game/Log/無LLM執行
- [x] R101 最後至少完整跑一局，多seed驗證不同互動並調整utility非劇本
- [x] R102 Polish spacing/typography/camera/lighting/materials/animation/transitions/colors/feedback/hierarchy
- [x] R103 逐條核對原文後半段與Completion Definition、Finalization、Final report
- [x] R104 另一個人依README可啟動；最終成果是可操作完成品

## 驗收證據

依階段在此加入執行結果；最終狀態對照 FINAL_REPORT.md 與 docs/QA_REPORT.md。

### 核心階段
- 環境證據：docs/ENVIRONMENT.md。
- Utility完整局：seed 2048 / 42 / 7 均結束且有winner；seed 7 出現合作與背叛，非固定劇本。
- Blender生成12組機器人，保留blend、GLB與生成script。
- 首次Vite build成功，實際Chrome渲染有3D canvas，完整UI QA待續。

### 實際QA階段
- `npm test`：10項行為/整合測試通過，含多局自動重開與最多3筆紀錄保留的測試設定。
- `npm run test:simulation`：20個種子完整結束，236結盟、248交易、14背叛、50合作。
- Playwright/Chrome：desktop1600×1000、mobile390×844，所有15組操作流程通過，無page/console/request錯誤。
- 真實Ollama結構化回覆通過驗證；cold-load約20秒，所以預設timeout改為30秒；Utility持續運行。
- R075/R076：Web build可行，公開host未執行，保留同origin backend部署說明；不是Unity，所以Unity WebGL不適用。
- R080：blend4.7MB、單一GLB约150KB，Git LFS已評估但不需要。
- R085：gh已登入，本項無登入例外不適用；未繞過認證。
- R093：實際20.28秒MP4已產出。

### 最終逐項驗收
- R001/R103：再次對照原文全部章節，包含Completion Definition、Polish Pass、最後驗證、Git Finalization、FINAL_REPORT後半段；104項皆有結果。
- R072：Windows unpacked與實際portable.exe均啟動並通過canvas/Pause/Resume/Restart/Selection；portable約一分鐘解壓，不只建置成功。
- R083/R086：Private repo已確認，main已push並比對commit相同；最終驗收commit後再比對。
- R094/R095/R096：FINAL_REPORT包含全部14項；COMPLETED/PARTIAL/NOT IMPLEMENTED清楚區分。
- R102：view_image檢視concept及最新實際browser/desktop/mobile截圖；天空/海面/地形triangulation、攝影機與字級已調整。
- R104：真正執行啟動、重复啟動、停止、重新啟動腳本，無重複server，保留正式版持續運行。
- 條件/可選範圍：公開部署未實作；Docker未實跑；remote模型未用外部credential驗證；Replay為timeline/sampled觀察；optional audio有ambient與event，無獨立UI click音效；上述皆如實記錄。
- 一般Git追蹤排除runtime/cache/build/model weights/secrets；private release單獨附可執行檔。

## v1.1 模擬品質與結算修正
- [x] V101：開發前追蹤全部新增要求；結束逐項驗收。
- [x] V102：至少50個 deterministic utility-only seed 基準，無Director或LLM介入。
- [x] V103：平均局長、角色存活時間、首次社交時間、trade/alliance/combat/betrayal發生率。
- [x] V104：比較調整前後，調整utility、資源互補、社交半徑、安全區與生存壓力；禁止固定劇本。
- [x] V105：大多數seed有多次跨角色實質互動；量測零社交全滅，加入持續防退化benchmark。
- [x] V106：同tick環境死亡公平處理，全滅明確EXTINCTION結局，無LAST SURVIVOR誤標。
- [x] V107：連續模式结算資料保持同局，時間、統計、匯出一致；瀏覽器回歸。
- [x] V108：觀賞性以正確局末社會摘要為此次範圍；角色卡/導播等既有功能保留，新增完整cinematic與人生軌跡列後續。
- [x] V109：公開網站建議列後續；此輪不直接公開部署，說明Docker與server-side key現況。
- [x] V110：測試、正式建置、文件、版本與可重复運行交付。


### v1.1 逐項驗收記錄
- V101–V103：先建追加清單；原版50-seed對照與新版兩組50-seed結果保留完整JSON，時間缺失單獨計數。
- V104–V105：無LLM/Director/劇本；交易11.30→14.82、互助2.84→3.60；100/100局均有交易、聯盟、戰鬥，零社交全滅0。npm test和本機pre-push hook執行gate；GitHub CI僅範本，帳號缺workflow scope。
- V106–V107：反轉角色順序的同tick死亡測試通過；全滅banner/modal/archive語義修正；跨局結算不漂移，兩次不同結局的匯出ID/統計/結果通過真實瀏覽器測試。
- V108–V109：本輪局末社會摘要已實作；新對話氣泡/聯盟動畫/死亡cinematic/完整人生軌跡與公開部署明確延後，未宣稱實作。Docker仍未實跑、remote key維持server-side。
- V110：11核心/HTTP測試、100-seed gate、20-seed smoke、15组瀏覽器workflow、結果桌面/mobile回歸、Windows unpacked及portable啟動均有證據；最後封裝與Git交付記錄見V1.1_REPORT。
- [x] V111：修復本機ERR_CONNECTION_REFUSED：確認舊PID已消失且4310無listener；WMI獨立背景啟動並保留stdout/stderr/PID，實跑重複啟動、停止、重新啟動與跨終端機HTTP驗證。瀏覽器安全規則阻擋操作錯誤頁，需使用者手動重新加載。

## zh-TW localization requirements
- [x] L01：預設zh-TW；Settings繁體中文/English切換。
- [x] L02：Browser與Electron語言持久化，重新開啟保留，無大型字體檔。
- [x] L03：集中字串、可維護翻譯鍵與動態模板、兩語鍵一致。
- [x] L04：不修改core、Seed、utility與gameplay；原始log不被翻譯改寫。
- [x] L05：導覽、統計、播放、觀察器、人格、關係、動態、六種Director事件名稱與說明。
- [x] L06：Winner/extinction、Historian、Replay、Settings、loading/error/connection、tooltips與所有modals。
- [x] L07：public_reason fallback、固定事件句型、observed、memory、goal/action、資源與武器顯示翻譯。
- [x] L08：名字/品牌/Utility AI/LLM/Seed可保留；自由LLM文本不強制翻譯，zh-TW模型文字提示且失敗不中斷。
- [x] L09：冷峻科幻自然中文＋少量技術英文；Windows CJK font stack，Browser/Electron無tofu。
- [x] L10：1920×1080與1366×768實測，無文字溢出/截斷/重疊；至少2張zh-TW實跑截圖。
- [x] L11：npm test、simulation regression、browser UI QA、desktop QA全部重跑。
- [x] L12：逐頁modal漏翻掃描；README語言切換說明；commit/push private repo。

### zh-TW 逐項驗收記錄
- L01–L03：360 個集中兩語鍵；預設繁中、Settings 立即切換；Browser reload 與 Electron 三次重開、不同 port 實測持久化。
- L04：core/config git diff 為空；100-seed JSON 基準與前版完全一致；暫停後語言切換的完整 snapshot deepEqual；adapter 不改寫原始 log。
- L05–L07：全部導覽與 modal、兩種結算、歷史、重播、tooltips、固定決策/事件/記憶翻譯；真實 Utility seeds 加六種 Director 事件覆蓋測試。
- L08–L09：品牌/名字/技術名詞保留，雙語觀測器標題；自由模型文字保持原樣、prose-only zh-TW prompt；Windows 真實 CJK font 計數有 glyph，無字體檔新增。
- L10：1920×1080、1366×768 的 controls/文字 scrollWidth 與 peer overlap 全通過；Browser/桌面實跑截圖存 docs/images/zh-TW-*，人工視覺確認。
- L11：npm test 15 項＋100-seed gate、20-seed simulation、原有15組 UI、結算回歸、繁中UI/斷線/錯誤、unpacked＋portable desktop QA 通過。
- L12：JSX AST＋runtime 英文漏翻掃描通過，README 與 docs/LOCALIZATION.md 已補語言切換及維護方式；Git/私人release交付見 localization report 與最終回覆。
# v1.4 Shareable Simulation Stories acceptance

- [x] Read complete v1.4 prompt and inspect existing save/log/replay/historian/event/relationship/memory/i18n/server/Electron systems.
- [x] Write docs/V1.4_PLAN.md and reuse existing archive and portraits.
- [x] Stable short URL-safe simulation_id, independent crypto RNG, persisted across Story/Replay/export and restart.
- [x] Versioned render-ready facts; schemaVersion 1 migration, unknown/corrupt format explicit failure.
- [x] Automatic permanent completed saves, bounded unfinished/debug logs, durable deletion.
- [x] Persisted independent /story/:id route; winner and extinction hero with ID/seed/date/duration/all statistics.
- [x] Data-derived five-phase bilingual summary independent of LLM.
- [x] Importance ranking with first/rare/social/combat/Director/final bonuses; limited major moments.
- [x] Collapsed complete timeline with category/type/agent/time filtering and pagination.
- [x] All cast cards with existing portraits, personality/fate/survival/four counters.
- [x] Agent life modal with biography, relationships, memories, personality and stats; no unsupported psychological claims.
- [x] Final relationship network with friendship/alliance/hostility and clickable pair timelines.
- [x] Important recorded relationship influences labelled honestly; no invented directional evolution.
- [x] Final Three / Last to Fall with truthful simultaneous ties and short biographies.
- [x] Data-derived awards with documented formulas and zero/tie handling.
- [x] Copy link, Web Share fallback, explicit local-only scope, configurable PUBLIC_BASE_URL.
- [x] Local 1200×630 share card and PNG download in Browser and Electron.
- [x] Safe JSON and complete Markdown story export (summary/result/stats/moments/cast/historian).
- [x] Upgrade unified library with ID/date/seed/outcome/duration/stats, search and five sorts, Story/Replay/Export/Delete.
- [x] Completion modal View Story without manual Save.
- [x] Authoritative list/detail/export/delete APIs; path validation and mutation origin guard.
- [x] Public serialization excludes secrets, provider config, paths and machine identity; escaped untrusted prose.
- [x] DATA_DIR/Docker persistence and public deployment documentation; truthful OG metadata status.
- [x] New UI centralized zh-TW/en catalog, CJK font fallback, cold editorial large-section design.
- [x] Major-moment replay seek and return to Story without rewriting engine.
- [x] Core/config unchanged; exact deterministic 100-seed benchmark unchanged.
- [x] Tests: serializer/ranking/biography/final-three/ID/persistence/API/locales/export/escaping/share URL/migration.
- [x] QA: winner/extinction/reload/old save/unknown/corrupt/long-many-events/no LLM/free prose/XSS/restart/continuous.
- [x] Browser QA: zh/en, 1920×1080, 1366×768, mobile, share/download/library/delete/deep-link.
- [x] Electron QA: route/locale/PNG/Markdown/replay/persistence and existing desktop regression.
- [x] Re-run npm test, i18n, simulation, Browser and desktop regression.
- [x] Four actual screenshots: v1.4-story-hero, major-moments, agent-story, share-card in docs/images.
- [x] README and 17-section docs/V1.4_REPORT.md with limitations and validation evidence.
- [x] Version 1.4.0 metadata, reasonable commits, clean tree, push main to existing private repo.
- [x] After acceptance: v1.4.0 tag/private release, Traditional Chinese notes and Windows portable asset.



# v1.5 Living World Update — 2026-10-03

來源：`docs/V1.5_REQUIREMENTS.txt`（完整 v1.5 使用者要求）。以下項目只有實作並驗證後才勾選；沿用既有專案，不重寫。

- [x] 檢查 world、Three.js、movement、resources、Utility、memory、relationships、Event Bus、Director、Replay、Story、persistence、i18n、QA；完成 docs/V1.5_PLAN.md。
- [x] 統一 World Interactable contract：id/type/position/state/capacity/durability/owner/controller/cooldown/usable/visible/metadata；canInteract/getUtility/performInteraction/events，權威端執行。
- [x] Door open/closed/locked/broken；open/close/force，移動、視線、庇護、控制有後果。
- [x] Container full/partial/empty/searched；search/take/leave，有限 Food/Water/Medicine/Weapon/Wood/Rare Supply。
- [x] Bed/rest spot 能量恢復、有限佔用、競爭與社交選擇。
- [x] Campfire light/use/extinguish；休息、夜間視野、社交、storm 熄火。
- [x] Medical station 有限 charge/medicine、容量、治療與戰略價值。
- [x] Generator online/offline/damaged、repair、簡化 local power zone 影響設施。
- [x] Watchtower occupy、perception/ambush risk/POI 視野提升；不無敵。
- [x] Radio broadcast；公開訊息/警告进入 Event Bus 與 knowledge。
- [x] Village/Clinic/Watchtower/Ruins/Supply Depot/Shelter/Bridge/Lake 功能不同；risk/resources/interactables/occupancy/controller/recentEvents。
- [x] POI control 含 Agent/Alliance，停留條件、轉移、避免/靠近/協商/挑戰，關係影響 utility，無硬性禁入。
- [x] Territory memory 有 location/POI、controller、recent danger、past conflict、known resources；容量有限。
- [x] Day/night 真正影響 perception、movement、lighting、campfire/shelter utility。
- [x] Clear/Rain/Storm 影響 movement/perception/shelter；Director storm 使用同一系統。
- [x] 至少兩種 gameplay hazards（Fire/Flood）；area/duration/damage/spread/crossing cost，進 path risk、可逃離/避開，事件有記錄。
- [x] Shelter 在 storm/night/low HP 增值，權衡距離、敵人、資源、urgency、personality。
- [x] Perception radius 受 night/storm/watchtower/building/terrain/simple blockers；Agent 不全知。
- [x] World knowledge Known/Recently Seen/Unknown/Stale；資源與控制資訊過期，不用向量資料庫。
- [x] interact/open/close/search/use/rest_at/heal_at/repair/occupy/broadcast/hide/take_cover 整合原 action executor。
- [x] Utility 真正使用世界狀態，有限知識、危險、控制關係；沒有固定角色/時間腳本或 teleport。
- [x] 空間社交與 existing trade/cooperate/ally/attack 接合；public/friendly/contested/hostile-controlled access 是 utility 影響。
- [x] 世界重要變化進 Event Bus：door/cache/fire/power/control/hazard/weather/broadcast 等。
- [x] Story World Moments、合理 ranking 不壓過 social；舊 Story 仍可讀。
- [x] Agent Life Story Important Places、most visited/death/victory/control duration/repair，完全依資料。
- [x] Replay 保存 weather/control/interactables/hazards，版本 migration/legacy fallback。
- [x] Three.js 顯示門、cache、火、電力、醫療、tower occupancy、controller、雨/夜；search/repair/heal/broadcast procedural feedback。
- [x] Navigation reroute closed door/blocked bridge/fire，至少 1–2 真正 choke points，不做大型 navmesh 重寫。
- [x] Economy 部分 medicine/weapon/food/water 移入 POI/stations/caches；seed 差異、depletion、stale search event。
- [x] hide/take_cover 降 detection/damage，代價 movement/resource opportunity。
- [x] Director food crisis/drop/plague/treasure/rumor 全部接合 Living World；可選 blackout/wildfire/collapse 僅核心完成後。
- [x] LLM relevant nearby objects/known locations/hazards/controllers/weather/time，限制 context；invalid interaction fallback Utility。
- [x] 12 agents、1x–10x 性能量測；無昂貴每 frame 全世界查詢。
- [x] Save/load 完整恢復 objects/control/weather/day/hazards/depletion/knowledge/RNG；保持舊 save/replay/story 可讀。
- [x] 50 primary + 50 holdout v1.5 golden，同 seed 重跑一致；記錄 winner/extinction/duration/social/combat/world/hazards。
- [x] Emergence metrics：visits/interactions/search/rest/heal/repair/control/shelter/avoidance/broadcast/social；100 seeds world 使用不接近零。
- [x] 新 unit/integration tests：interactables/POI utility/weather/hazard/control/persistence/replay/story/navigation/determinism。
- [x] 完整 QA：Door、depletion、occupancy、fire、heal、repair、tower、radio、control/transfer、day/night/rain/storm/hazards/bridge/avoidance/shelter/perception/stale/save/replay/story/director。
- [x] npm test、test:i18n、test:ui、test:results、test:story、test:desktop、test:story:desktop 全通過；v1.4 Story 不退化。
- [x] Browser/Electron zh-TW/en；1920×1080、1366×768、390×844 Story/mobile 真實視覺 QA。
- [x] docs/images/v1.5-day-world.png、v1.5-night-world.png、v1.5-clinic-control.png、v1.5-storm-shelter.png、v1.5-fire-event.png 實際執行截图；影片可選。
- [x] docs/V1.5_REPORT.md 18 項：Goal/Architecture/Interactables/POI/Utility/Territory/Weather/Hazards/Perception/Navigation/Persistence/Replay/Story/Determinism/Benchmark/Performance/QA/Limitations。
- [x] README Living World、操作、screenshots 更新；package/Electron/UI/README/release v1.5.0 一致。
- [x] 合理分 commit、push 原 private repo、Git clean。
- [x] 全部驗收後 tag v1.5.0、private GitHub Release、Windows portable、繁體中文 notes，保留舊 release。
- [x] 最終逐項驗收；任何未完成不得寫 COMPLETE；stretch 不犧牲核心品質。

最終驗收：27/27 與 100-seed golden、Browser／Electron／portable 全部通過；私人 Release v1.5.0 已發布，GitHub asset digest 與本機一致。應用程式 revision b118945，Release tag 725ffde，發布後驗收紀錄另提交至 main。

## v1.6.0 — Physical World & Visual Polish

原始完整需求：docs/V1.6_REQUIREMENTS.txt。以下保留每項核心功能與附件驗收條件；P1 / 非 P0 / Stretch 另記，不能冒充完成。

- [x] Phase 1 — Inspect Existing Art & Rendering Pipeline
- [x] 核心功能 1 — POI Visual Redesign
- [x] 核心功能 2 — Blender Asset Pipeline Upgrade
- [x] 核心功能 3 — Modular Asset Kit
- [x] 核心功能 4 — Stateful Visual Objects
- [x] 核心功能 5 — Real Interaction Animation
- [x] 核心功能 6 — Contextual Agent Facing
- [x] 核心功能 7 — Locomotion Polish
- [x] 核心功能 8 — POI Interior / Semi-Interior
- [x] 核心功能 9 — Interior Lighting
- [x] 核心功能 10 — Environmental Damage States
- [x] 核心功能 11 — Environmental Traces
- [x] 核心功能 12 — World History Layer
- [x] 核心功能 13 — Control Visual Language
- [x] 核心功能 14 — Less Floating Labels
- [x] 核心功能 15 — World UI Declutter
- [x] 核心功能 16 — Interaction Status Bubble
- [x] 核心功能 17 — Dialogue Bubble Upgrade
- [x] 核心功能 18 — Combat Visual Feedback
- [x] 核心功能 19 — Death State
- [x] 核心功能 20 — Fire Visual Upgrade
- [x] 核心功能 21 — Flood Visual Upgrade
- [x] 核心功能 22 — Weather Polish
- [x] 核心功能 23 — Day / Night Polish
- [x] 核心功能 24 — Vegetation Motion
- [x] 核心功能 25 — Water Polish
- [x] 核心功能 26 — Roads & Paths
- [x] 核心功能 27 — Scene Composition
- [x] 核心功能 28 — Camera Polish
- [x] 核心功能 29 — Event Camera
- [x] 核心功能 30 — Observer / Cinematic Toggle
- [x] 核心功能 31 — Cinematic HUD
- [x] 核心功能 32 — Major Event Banner
- [x] 核心功能 33 — Visual Sound Feedback
- [ ] 核心功能 34 — Audio Spatialization（非 P0，延後，未實作）
- [ ] 核心功能 35 — Story Screenshot Integration（P1，延後，未實作）
- [x] 核心功能 36 — Replay Visual Fidelity
- [x] 核心功能 37 — Asset Loading
- [x] 核心功能 38 — Performance Budget
- [x] 核心功能 39 — LOD
- [x] 核心功能 40 — Draw Call Discipline
- [x] Blender Art Direction
- [x] Materials
- [x] Lighting
- [x] Postprocessing
- [x] Accessibility
- [x] Localization
- [x] Story Compatibility
- [x] Save Compatibility
- [x] Determinism
- [x] Before / After QA
- [x] Visual Acceptance Scenarios
- [x] Automated QA
- [x] Screenshot QA
- [x] Required Screenshots
- [x] Documentation
- [x] README
- [x] Git Strategy
- [x] Version
- [x] Release
- [x] 8 個 POI 視覺明顯不同
- [x] Clinic 一眼可辨識
- [x] Watchtower 真的有高塔結構
- [x] Depot 有 crates / storage visual
- [x] Shelter 有可進入空間
- [x] Bridge blocked state 可見
- [x] Lake / river 更像真正水體
- [x] Door 真的開關
- [x] Container full / empty 可辨識
- [x] Generator offline / damaged / online 可辨識
- [x] Medical station active / unavailable 可辨識
- [x] Campfire 狀態可辨識
- [x] Search 有 animation
- [x] Repair 有 animation
- [x] Heal 有 animation
- [x] Rest 有 animation
- [x] Broadcast 有 animation
- [x] Agent interaction 時會正確轉向
- [x] locomotion 不再像滑動
- [x] combat 有 hit feedback
- [x] death 有 shutdown state
- [x] POI control 不看 label 也看得出來
- [x] contested state 可辨識
- [x] fire 視覺與 gameplay state 一致
- [x] flood 視覺與 blocker 一致
- [x] rain / storm 明顯不同
- [x] day / sunset / night 可辨識
- [x] powered POI 夜間有光
- [x] environmental traces 存在
- [x] UI labels 減少 clutter
- [x] zoom-aware labels 正常
- [x] cinematic mode 正常
- [x] event camera 不亂跳
- [x] Replay 顯示歷史 world state
- [x] v1.5 saves 可讀
- [x] v1.4 / v1.5 Story 可讀
- [x] zh-TW 完整
- [x] English 完整
- [x] Browser 正常
- [x] Electron 正常
- [x] portable 正常
- [x] simulation RNG 不被 visual effects 污染
- [x] 若 gameplay 未改，v1.5 golden 完全一致
- [x] Performance 可接受
- [x] Blender source 保留
- [x] procedural generation script 可重建
- [x] README 更新
- [x] V1.6_REPORT 完成
- [x] before / after 截圖完成
- [x] Git clean
- [x] push private repo
- [x] v1.6.0 Release 完成

驗收證據：docs/qa/*-v1.6.json、tests/visual-state.test.mjs 與 docs/V1.6_REPORT.md。LOD 經預算評估採共享幾何、instancing、遠近標籤層級；本次無新增幾何 LOD。影片是非 P0，未產出。

## v1.7.0 — Spatial Intelligence & Physical Interaction

完整原文：docs/V1.7_REQUIREMENTS.txt。所有核心項目逐項驗收；Stretch 僅核心完成後考慮。

- [ ] 本版本核心目標
- [ ] 最高原則
- [ ] 嚴格限制
- [x] Phase 1 — Inspect Existing Spatial Stack
- [x] 核心功能 1 — Collision Geometry
- [x] 核心功能 2 — Blender Collision Export
- [x] 核心功能 3 — Static Collision
- [x] 核心功能 4 — Character Collision Shape
- [x] 核心功能 5 — Dynamic Door Collision
- [ ] 核心功能 6 — Walkable Area
- [ ] 核心功能 7 — NavMesh / Polygon Navigation
- [x] 核心功能 8 — Portal System
- [ ] 核心功能 9 — A* Pathfinding
- [x] 核心功能 10 — Path Smoothing
- [ ] 核心功能 11 — Dynamic Obstacles
- [x] 核心功能 12 — Agent-to-Agent Local Avoidance
- [x] 核心功能 13 — Personal Space
- [ ] 核心功能 14 — Narrow Passage Behavior
- [x] 核心功能 15 — Queueing
- [x] 核心功能 16 — Interaction Slots
- [x] 核心功能 17 — Slot Reservation
- [x] 核心功能 18 — Occupancy
- [ ] 核心功能 19 — Interaction Reachability
- [ ] 核心功能 20 — Path Cost
- [ ] 核心功能 21 — Terrain Cost
- [ ] 核心功能 22 — Slope / Height Constraint
- [ ] 核心功能 23 — Stairs / Ramps
- [ ] 核心功能 24 — Vertical Node Support
- [x] 核心功能 25 — Line of Sight Upgrade
- [x] 核心功能 26 — Combat Line of Fire
- [x] 核心功能 27 — Interaction Line of Sight
- [ ] 核心功能 28 — Stuck Detection
- [ ] 核心功能 29 — Deadlock Avoidance
- [ ] 核心功能 30 — Path Reservation Lite
- [ ] 核心功能 31 — Visual Path Debug Mode
- [ ] 核心功能 32 — Click Debug
- [ ] 核心功能 33 — Render Collision Alignment
- [ ] 核心功能 34 — Interaction Animation Alignment
- [ ] 核心功能 35 — Door Animation Alignment
- [ ] 核心功能 36 — Replay Spatial Fidelity
- [ ] 核心功能 37 — Save / Load
- [ ] 核心功能 38 — Determinism
- [ ] 核心功能 39 — Spatial Metrics
- [ ] 核心功能 40 — Acceptance Gates
- [x] 核心功能 41 — Collision Regression Tests
- [ ] 核心功能 42 — Navigation Tests
- [x] 核心功能 43 — Queue Tests
- [x] 核心功能 44 — Local Avoidance Tests
- [x] 核心功能 45 — High Density Test
- [ ] 核心功能 46 — Performance
- [ ] 核心功能 47 — Spatial Index
- [ ] 核心功能 48 — Collision Debug Screenshots
- [ ] 核心功能 49 — Visual Before / After
- [ ] 核心功能 50 — UI
- [ ] Blender Requirements
- [x] Collision Data Format
- [ ] Backward Compatibility
- [ ] Story Integration
- [ ] Agent Life Story
- [ ] Replay Integration
- [ ] Browser / Electron
- [ ] QA Resolution
- [ ] Existing Test Suites
- [ ] New Test Suites
- [ ] Benchmark
- [ ] Documentation
- [ ] README
- [ ] Version
- [ ] Git
- [ ] Release
- [ ] Acceptance Criteria
- [ ] Stretch Goals
- [ ] 最重要的產品目標

### v1.7 最終驗收

- [ ] Render mesh 與 collision mesh 分離
- [ ] Collision data versioned
- [ ] Static walls 真正阻擋 Agent
- [ ] Closed door 阻擋
- [ ] Open door 可通過
- [ ] Broken door 正確
- [ ] Deep water 不可走
- [ ] Walkable regions 存在
- [ ] Clinic interior 可正常進出
- [ ] Shelter interior 可正常進出
- [ ] Depot interior 可正常進出
- [ ] Watchtower 不 teleport，可沿路徑上去
- [ ] Ruins vertical path 正常
- [ ] Portal graph 正常
- [ ] A* 正常
- [ ] Path smoothing 正常
- [ ] Dynamic blocker 會 replan
- [ ] Agent 不穿牆
- [ ] Agent 不互穿
- [ ] Agent 不長時間疊在一起
- [ ] 狹門不會永久 deadlock
- [ ] Local avoidance 正常
- [ ] Interaction slots 正常
- [ ] Slot reservation 正常
- [ ] Occupancy 正常
- [ ] 多 Agent 不會同時佔一張床
- [ ] 多 Agent 不會疊在 Generator 同一點
- [ ] pathDistance 進 utility reachability
- [ ] 隔牆不能互動
- [ ] 隔牆不能攻擊
- [ ] LOS 使用 authoritative collision
- [ ] Terrain cost 正常
- [ ] blocked bridge reroute
- [ ] stuck detection 正常
- [ ] 不使用 teleport 解正常 gameplay stuck
- [ ] Spatial debug overlay 正常
- [ ] Save/load 正常
- [ ] Replay 正常
- [ ] v1.6 Story 正常
- [ ] zh-TW 正常
- [ ] English 正常
- [ ] Browser 正常
- [ ] Electron 正常
- [ ] portable 正常
- [ ] 同 v1.7 Seed 可完全重現
- [ ] 100-seed golden 完成
- [ ] 無大量 stuck / deadlock
- [ ] 10x simulation 性能可接受
- [ ] README 更新
- [ ] V1.7_REPORT 完成
- [ ] Git clean
- [ ] push private repo
- [ ] v1.7.0 Release 完成
