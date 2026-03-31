var express = require("express");
var router = express.Router();
let messageSchema = require("../schemas/messages");
let { CheckLogin } = require("../utils/authHandler");
let multer = require("multer");
let path = require("path");

// Multer riêng cho messages - chấp nhận mọi loại file
let messageStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "uploads/");
    },
    filename: function (req, file, cb) {
        let ext = path.extname(file.originalname);
        let fileName = Date.now() + "-" + Math.round(Math.random() * 1_000_000_000) + ext;
        cb(null, fileName);
    }
});
let upload = multer({ storage: messageStorage, limits: 10 * 1024 * 1024 });

/**
 * GET /:userID
 * Lấy toàn bộ tin nhắn giữa user hiện tại và userID
 * (from: currentUser, to: userID) HOẶC (from: userID, to: currentUser)
 */
router.get("/:userID", CheckLogin, async function (req, res, next) {
    try {
        let currentUserId = req.user._id;
        let targetUserId = req.params.userID;

        let messages = await messageSchema
            .find({
                $or: [
                    { from: currentUserId, to: targetUserId },
                    { from: targetUserId, to: currentUserId }
                ]
            })
            .populate("from", "username email avatarUrl fullName")
            .populate("to", "username email avatarUrl fullName")
            .sort({ createdAt: 1 }); // sắp xếp theo thời gian tăng dần

        res.send(messages);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

/**
 * POST /
 * Gửi tin nhắn mới
 * Body (form-data hoặc json):
 *   - to: userID người nhận
 *   - file (tùy chọn): file đính kèm (multipart/form-data)
 *   - text (tùy chọn, nếu không có file): nội dung text
 */
router.post(
    "/",
    CheckLogin,
    upload.single("file"),
    async function (req, res, next) {
        try {
            let currentUserId = req.user._id;
            let { to, text } = req.body;

            if (!to) {
                return res.status(400).send({ message: "Thiếu trường 'to' (người nhận)" });
            }

            let messageContent;

            if (req.file) {
                // Có file đính kèm -> type là "file", text là path dẫn đến file
                messageContent = {
                    type: "file",
                    text: req.file.path
                };
            } else {
                // Không có file -> type là "text", text là nội dung gửi
                if (!text || text.trim() === "") {
                    return res
                        .status(400)
                        .send({ message: "Nội dung tin nhắn không được để trống" });
                }
                messageContent = {
                    type: "text",
                    text: text.trim()
                };
            }

            let newMessage = new messageSchema({
                from: currentUserId,
                to: to,
                messageContent: messageContent
            });

            await newMessage.save();
            await newMessage.populate("from", "username email avatarUrl fullName");
            await newMessage.populate("to", "username email avatarUrl fullName");

            res.status(201).send(newMessage);
        } catch (err) {
            res.status(500).send({ message: err.message });
        }
    }
);

/**
 * GET /
 * Lấy tin nhắn cuối cùng của mỗi cuộc trò chuyện mà user hiện tại tham gia
 * (user hiện tại đã nhắn hoặc người khác đã nhắn cho user hiện tại)
 */
router.get("/", CheckLogin, async function (req, res, next) {
    try {
        let currentUserId = req.user._id;

        // Aggregate để lấy tin nhắn mới nhất theo từng cặp user
        let lastMessages = await messageSchema.aggregate([
            {
                // Lọc tất cả message có liên quan đến user hiện tại
                $match: {
                    $or: [
                        { from: currentUserId },
                        { to: currentUserId }
                    ]
                }
            },
            {
                // Tạo trường "partner" là user kia (không phải user hiện tại)
                $addFields: {
                    partner: {
                        $cond: {
                            if: { $eq: ["$from", currentUserId] },
                            then: "$to",
                            else: "$from"
                        }
                    }
                }
            },
            {
                // Sắp xếp theo thời gian giảm dần để $first lấy được tin mới nhất
                $sort: { createdAt: -1 }
            },
            {
                // Nhóm theo partner, lấy tin nhắn mới nhất
                $group: {
                    _id: "$partner",
                    lastMessage: { $first: "$$ROOT" }
                }
            },
            {
                // Gộp lại thành object phẳng hơn
                $replaceRoot: { newRoot: "$lastMessage" }
            },
            {
                // Sắp xếp lại theo thời gian giảm dần
                $sort: { createdAt: -1 }
            }
        ]);

        // Populate thủ công vì aggregate không hỗ trợ populate trực tiếp
        let populated = await messageSchema.populate(lastMessages, [
            { path: "from", select: "username email avatarUrl fullName" },
            { path: "to", select: "username email avatarUrl fullName" }
        ]);

        res.send(populated);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

module.exports = router;
