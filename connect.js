import express from "express";
import mysql from "mysql2";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";
// Để lấy __dirname trong ES module, cần sử dụng fileURLToPath
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// Cấu hình view engine là EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.json());
// Kết nối MySQL
const db = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "teas"
});
app.get("/", (req, res) => {
    res.render("index"); // Render file index.ejs
});
// Khởi tạo Google Generative AI
const genAI = new GoogleGenerativeAI("AIzaSyDrJuP95rXc93gfGEY1V8y2bM3AVTHUjC0");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Route API
app.post("/generate-tea-response", async (req, res) => {
    try {
        const { currentQuestion, isFirstQuestion } = req.body;

        if (!currentQuestion) {
            return res.status(400).json({ error: "Câu hỏi hiện tại là bắt buộc." });
        }

        db.query("SELECT name, price, description FROM teas", async (error, results) => { // Thêm async vào callback
            if (error) {
                console.error("Lỗi truy vấn SQL:", error);
                return res.status(500).json({ error: "Lỗi truy vấn database." });
            }

            if (!results || results.length === 0) {
                console.log("Không có dữ liệu trà.");
                return res.json({ aiResponse: "Hiện tại chúng tôi không có loại trà nào.", teaData: [] });
            }

            const teaList = results.map(tea => `${tea.name}: ${tea.price} VND - ${tea.description}`).join("\n");
            console.log(isFirstQuestion);
            const prompt = isFirstQuestion
                ? `Bạn là trợ lý AI cho một cửa hàng trà. Đây là danh sách trà hiện có:\n${teaList}\n\nKhách hàng hỏi: "${currentQuestion}"\nHãy trả lời một cách chi tiết và đề xuất các loại trà phù hợp.`
                : `Bạn là trợ lý AI cho một cửa hàng trà. Đây là danh sách trà hiện có:\n${teaList}\n\nBạn đã trả lời câu hỏi trước đó là "Xin chào" và 1 số câu hỏi khác.\nKhách hàng hỏi tiếp: "${currentQuestion}"\nHãy trả lời câu hỏi này dựa trên ngữ cảnh hiện tại.`;

            try { // Bọc việc gọi Gemini API trong try...catch riêng
                const result = await model.generateContent(prompt);
                res.json({
                    aiResponse: result.response?.text() || "Không có phản hồi từ AI.",
                    teaData: results
                });
            } catch (geminiError) {
                console.error("Lỗi Gemini:", geminiError);
                return res.status(500).json({ error: "Lỗi khi giao tiếp với AI." });
            }
        });
    } catch (error) { // Lỗi ở đây là lỗi tổng quát bên ngoài db.query, ít khả năng xảy ra
        console.error("Lỗi tổng quát:", error);
        res.status(500).json({ error: "Lỗi server nội bộ." });
    }
});
// Khởi động server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
