const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/imageupload', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// schemas defined 
const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    profileImage: String,
});

const messageSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    content: String,
    image: String,
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);

// Multer config that we need for uploading files 
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'uploads';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Only image files are allowed!'));
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Upload profile image
app.put('/users/:userId/profile-image', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const user = await User.findById(req.params.userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Delete old profile image if exists
        if (user.profileImage) {
            const oldImagePath = path.join(__dirname, user.profileImage);
            if (fs.existsSync(oldImagePath)) {
                fs.unlinkSync(oldImagePath);
            }
        }

        user.profileImage = '/uploads/' + req.file.filename;
        await user.save();

        res.json({
            message: 'Profile image updated successfully',
            profileImage: user.profileImage
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Create message with image
app.post('/messages', upload.single('image'), async (req, res) => {
    try {
        const { userId, content } = req.body;

        const message = new Message({
            userId,
            content,
            image: req.file ? '/uploads/' + req.file.filename : null
        });

        await message.save();
        res.status(201).json(message);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get messages
app.get('/messages', async (req, res) => {
    try {
        const messages = await Message.find()
            .populate('userId', 'username profileImage')
            .sort('-createdAt');
        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Error handling middleware (not my code)
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ message: 'File is too large. Maximum size is 5MB' });
        }
    }
    res.status(500).json({ message: error.message });
});

// For local viewing 
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running... port: ${PORT}`);
});