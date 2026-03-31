const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
    {
        from: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user",
            required: [true, "Sender (from) is required"]
        },
        to: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "user",
            required: [true, "Receiver (to) is required"]
        },
        messageContent: {
            type: {
                type: String,
                enum: ["file", "text"],
                required: [true, "Message content type is required"]
            },
            text: {
                type: String,
                required: [true, "Message content text is required"]
            }
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("message", messageSchema);
