import React from 'react';
import { Layout, Typography, Space } from 'antd';
import { AudioOutlined, SettingOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';

const { Header, Content, Footer } = Layout;
const { Title } = Typography;

const AppLayout = ({ children }) => {
  return (
    <Layout className="app-layout" style={{ minHeight: '100vh' }}>
      <Header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        background: '#fff',
        boxShadow: '0 1px 4px rgba(0, 21, 41, 0.08)',
        position: 'sticky',
        top: 0,
        zIndex: 1,
      }}>
        <Space align="center">
          <AudioOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
          <Title level={4} style={{ margin: 0, color: '#1890ff' }}>Universal Translator</Title>
        </Space>
        <Space>
          <Link to="/audio-test">
            <SettingOutlined style={{ fontSize: '18px', color: '#666' }} />
          </Link>
          <div id="window-controls">
            <button id="minimize-btn" className="window-control">−</button>
            <button id="maximize-btn" className="window-control">□</button>
            <button id="close-btn" className="window-control close">×</button>
          </div>
        </Space>
      </Header>
      
      <Content style={{
        padding: '24px',
        background: '#f0f2f5',
        minHeight: 'calc(100vh - 64px)',
      }}>
        <div style={{
          background: '#fff',
          padding: '24px',
          borderRadius: '8px',
          minHeight: 'calc(100vh - 112px)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          {children}
        </div>
      </Content>
      
      <Footer style={{
        textAlign: 'center',
        padding: '16px 50px',
        background: '#f0f2f5',
        borderTop: '1px solid #f0f0f0'
      }}>
        Universal Translator ©{new Date().getFullYear()} - Real-time Translation App
      </Footer>
    </Layout>
  );
};

export default AppLayout;
