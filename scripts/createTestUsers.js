/**
 * Script: Tạo 2 user test để demo Postman
 * Cách dùng: node scripts/createTestUsers.js
 */

const mongoose = require('mongoose');
const userModel = require('../schemas/users');
const roleModel = require('../schemas/roles');

async function main() {
    console.log('🔌 Kết nối MongoDB...');
    await mongoose.connect('mongodb://localhost:27017/NNPTUD-S3');
    console.log('✅ Kết nối thành công!\n');

    // Tìm role bất kỳ trong DB
    let role = await roleModel.findOne({ isDeleted: false });
    if (!role) {
        console.error('❌ Không tìm thấy role nào trong DB. Hãy tạo role trước.');
        process.exit(1);
    }
    console.log('✅ Dùng role:', role.name, '|', role._id);

    const testUsers = [
        { username: 'testuser1', email: 'testuser1@test.com', password: 'Test@1234' },
        { username: 'testuser2', email: 'testuser2@test.com', password: 'Test@1234' },
    ];

    for (const u of testUsers) {
        const existing = await userModel.findOne({ username: u.username });
        if (existing) {
            console.log(`⏭️  User "${u.username}" đã tồn tại, bỏ qua.`);
            continue;
        }
        const newUser = new userModel({
            username: u.username,
            email: u.email,
            password: u.password,
            role: role._id,
            status: true,
        });
        await newUser.save();
        console.log(`✅ Tạo user: ${u.username} | password: ${u.password} | _id: ${newUser._id}`);
    }

    console.log('\n🏁 Xong!');
    await mongoose.disconnect();
}

main().catch(err => {
    console.error('💥 Lỗi:', err.message);
    process.exit(1);
});
