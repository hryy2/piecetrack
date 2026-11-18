PieceTrack — 手写识别部分的全部产出（2026-11-17）

template/  手写样本采集模板（4 页 A4，打印时页码范围选 1 可只印第一页）
code/      两条图像提取通路 + 训练 + 质检脚本
           build_model.js  从模板 HTML 量出格子坐标，生成 template_model.json
                           （改了模板就要重跑这个，用 node 执行，需 playwright）
           warp_cells.py   新模板（有基准黑块）：四点单应性矫正后切图
           grid_cells.py   旧模板（无黑块）：格线形态学 + 投影定位后切图
           dataset.py      按书写人切分、预处理、数据增强
           train.py        训练与评估        coverage.py 置信度-覆盖率
           contact_sheet.py / outliers.py / sheet_montage.py  三个质检工具
           exclude.txt     人工排除的格子及理由
models/    9 个训练好的模型 + 每次实验的结果 JSON + 完整训练日志
           交付用的两个：zh_mild.pt（中文 93.1%）、en_noaug.pt（英文 86.7%）
docs/      项目规格与 AI Studio 提示词
qa/        质检图

样本数据在另一个压缩包 piecetrack-crops.zip 里（6174 个 crop）。
原始照片（Samples.zip / Samples2.zip）是你自己上传的，在你手上。

常用命令：
  python3 warp_cells.py <照片...> --out crops --writer A11
  python3 grid_cells.py <照片...> --out crops --writer A1
  python3 train.py --task zh --epochs 60 --mild --out zh.pt
  python3 coverage.py zh.pt
