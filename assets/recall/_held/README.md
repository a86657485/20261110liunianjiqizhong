# GM37 现稿暂不接入

`GM37.webp` 已从学生可见托管路径 `assets/recall/GM37.webp` 搬到本目录。

原因：总管已退回重出——现稿指纹区是绿灯，有泄答风险。题库字段未改，仍指向 `assets/recall/GM37.webp`；该路径应 404，客户端 `RecallPanel` 的 `onError` 会回退中性占位。不要把本目录现稿交给学生看到。

等重出通过后再替换回 `assets/recall/GM37.webp`。本目录中的 webp 不入库。
