import React from 'react';

const StatCard = ({ title, value, icon }) => {
    return (
        <div className="widget">
            <h3>{value}</h3>
            <p>{title}</p>
        </div>
    );
};

export default StatCard;
