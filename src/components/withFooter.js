// src/components/withFooter.js
import React from 'react';
import AppLayout from './AppLayout';
import { roleTabs, routeMap } from '../navigation/config';


import userService from '../services/userService';

const withFooter = (ScreenComp, activeKey) => (props) => {
  const [role, setRole] = React.useState(null);

  React.useEffect(() => {
    let mounted = true;
    userService.getUser().then(user => {
      if (!mounted) return;
      console.log('user in withFooter', user.data.role);
      setRole(user.data.role || 'supporter');
    });
    return () => {
      mounted = false;
    };
  }, []);


  if (!role) return null; // Hoặc có thể là loading component

  const TABS = roleTabs[role];  // Chọn TABS từ role
  const centerKey = TABS.find(t => t.center)?.key || 'home';  // Chọn center tab (home mặc định)

  return (
    <AppLayout
      activeTab={activeKey}
      onChangeTab={(key) => {
        const routeName = routeMap[key] || 'DefaultScreen';
        props.navigation.navigate(routeName);
      }}
      centerKey={centerKey}  // Truyền centerKey vào AppLayout
      TABS={TABS}            // Truyền TABS vào AppLayout
    >
      <ScreenComp {...props}
      role={role}
      userRole={role}
      currentRole={role} />
    </AppLayout>
  );
};

export default withFooter;
