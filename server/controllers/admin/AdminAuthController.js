const AdminModel = require('../../models/admin/AdminModel');
const jwt = require('jsonwebtoken');

exports.loginAdmin = async (req, res) => {
    const { email, password } = req.body;
    // TODO: Validate input

    // Demo Login (Replace with DB check)
    // Dynamic Admin Email based on Domain (e.g., Admin@chatmat.in)
    const domain = process.env.DOMAIN;
    const adminEmail = `Admin@${domain}`;

    // Case-insensitive email check
    if (email.toLowerCase() === adminEmail.toLowerCase() && password === 'Admin@12345') {
        const token = jwt.sign({ id: 'demo-admin', email }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
        return res.json({ token, admin: { email, name: 'Super Administrator' } });
    }

    // Real DB Implementation would be:
    // const admin = await AdminModel.findOne({ email });
    // if (!admin || !await bcrypt.compare(password, admin.password)) ...

    res.status(401).json({ message: 'Invalid credentials' });
};

exports.getMe = (req, res) => {
    res.json(req.admin);
};

exports.logoutAdmin = (req, res) => {
    res.json({ message: 'Logged out' });
};
