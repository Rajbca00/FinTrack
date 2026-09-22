import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Accounts } from "./pages/Accounts";
import { AccountDetail } from "./pages/AccountDetail";
import { Buckets } from "./pages/Buckets";
import { BucketDetail } from "./pages/BucketDetail";
import { Transactions } from "./pages/Transactions";
import { Categories } from "./pages/Categories";
import { Transfers } from "./pages/Transfers";
import { NetWorth } from "./pages/NetWorth";
import { Goals } from "./pages/Goals";
import { Budgets } from "./pages/Budgets";
import { Bills } from "./pages/Bills";
import { Settings } from "./pages/Settings";

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/accounts/:id" element={<AccountDetail />} />
        <Route path="/buckets" element={<Buckets />} />
        <Route path="/buckets/:id" element={<BucketDetail />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/transfers" element={<Transfers />} />
        <Route path="/net-worth" element={<NetWorth />} />
        <Route path="/goals" element={<Goals />} />
        <Route path="/budgets" element={<Budgets />} />
        <Route path="/bills" element={<Bills />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/categories" element={<Categories />} />
      </Route>
    </Routes>
  );
}

export default App;
