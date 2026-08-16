const jwt = require('jsonwebtoken');

exports.verifyAdminToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        req.admin = decoded;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Invalid token' });
    }
};

exports.verifySuperAdmin = (req, res, next) => {
    exports.verifyAdminToken(req, res, () => {
        if (req.admin && (req.admin.role === 'SUPER_ADMIN' || req.admin.role === 'super_admin')) {
            next();
        } else {
            res.status(403).json({ message: 'Forbidden: Super Admin access required' });
        }
    });
};
