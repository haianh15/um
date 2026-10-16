import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PaymentNotice, PaymentReceipt } from '../../types';
import {
  CreditCard, CheckCircle2, AlertCircle, Clock, RotateCcw,
  Landmark, ArrowRight, ShieldCheck, History, X, Search, Filter,
  FileText, AlertTriangle, ArrowUpRight, Check, Eye
} from 'lucide-react';

export const PaymentReceiptsView: React.FC = () => {
  const {
    paymentNotices,
    paymentReceipts,
    confirmPaymentReceipt08_2,
    revertPaymentReceipt08_2,
    activeBankAccount,
    currentUser
  } = useApp();

  // Tab: UC08.1 vs UC08.2
  const [activeTab, setActiveTab] = useState<'uc08_1' | 'uc08_2'>('uc08_1');

  // Filters for UC08.1
  const [roomFilter, setRoomFilter] = useState<string>('ALL');
  const [periodFilter, setPeriodFilter] = useState<string>('ALL');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'ALL' | 'UNPAID' | 'PAID' | 'OVERDUE'>('ALL');
  const [noticeStatusFilter, setNoticeStatusFilter] = useState<'ALL' | 'ACTIVE' | 'REPLACED'>('ALL');

  // Modal Confirm Receipt (UC08.2)
  const [selectedNotice, setSelectedNotice] = useState<PaymentNotice | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [amountReceived, setAmountReceived] = useState<number>(0);
  const [receivedDate, setReceivedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [txnCode, setTxnCode] = useState<string>('');
  const [proofFile, setProofFile] = useState<string>('');
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // Modal Revert Receipt (AF-03 / BR-UC08.2-06, BR-UC08.2-10)
  const [showRevertModal, setShowRevertModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentReceipt | null>(null);
  const [revertReason, setRevertReason] = useState<string>('');
  const [revertError, setRevertError] = useState<string | null>(null);

  // Detail Modal for Inspection
  const [inspectNotice, setInspectNotice] = useState<PaymentNotice | null>(null);

  // Filter options
  const uniqueRooms = Array.from(new Set(paymentNotices.map(n => n.roomCode)));
  const uniquePeriods = Array.from(new Set(paymentNotices.map(n => n.periodCode)));

  // Filtered Notices for UC08.1
  const filteredNotices = paymentNotices.filter(n => {
    if (roomFilter !== 'ALL' && n.roomCode !== roomFilter) return false;
    if (periodFilter !== 'ALL' && n.periodCode !== periodFilter) return false;
    if (noticeStatusFilter === 'ACTIVE' && n.status !== 'Đang hiệu lực') return false;
    if (noticeStatusFilter === 'REPLACED' && n.status !== 'Đã thay thế') return false;

    const isOverdue = n.paymentStatus === 'Chưa thu' && new Date(n.dueDate) < new Date();
    if (paymentStatusFilter === 'UNPAID' && n.paymentStatus !== 'Chưa thu') return false;
    if (paymentStatusFilter === 'PAID' && n.paymentStatus !== 'Đã thu') return false;
    if (paymentStatusFilter === 'OVERDUE' && (!isOverdue || n.paymentStatus !== 'Chưa thu')) return false;

    return true;
  });

  // Financial Stats
  const totalReceivable = paymentNotices
    .filter(n => n.status === 'Đang hiệu lực')
    .reduce((sum, n) => sum + n.totalAmount, 0);

  const totalCollected = paymentNotices
    .filter(n => n.status === 'Đang hiệu lực' && n.paymentStatus === 'Đã thu')
    .reduce((sum, n) => sum + n.totalAmount, 0);

  const totalUncollected = totalReceivable - totalCollected;

  const overdueCount = paymentNotices.filter(
    n => n.status === 'Đang hiệu lực' && n.paymentStatus === 'Chưa thu' && new Date(n.dueDate) < new Date()
  ).length;

  // Open Confirm Modal
  const openConfirmModal = (notice: PaymentNotice) => {
    if (notice.status === 'Đã thay thế') {
      alert('BR-UC08.1-05: Không được xác nhận thu bằng mã QR hoặc thông báo đã bị thay thế.');
      return;
    }
    if (notice.paymentStatus === 'Đã thu') {
      alert('AF-04: Thông báo này đã được xác nhận thu đủ. Không thực hiện xác nhận thu lần nữa.');
      return;
    }

    setSelectedNotice(notice);
    setAmountReceived(notice.totalAmount);
    setReceivedDate(new Date().toISOString().split('T')[0]);
    setTxnCode('FT' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + Math.floor(Math.random() * 89999 + 10000));
    setProofFile('bien_nhan_chuyen_khoan_' + notice.roomCode.toLowerCase() + '.jpg');
    setConfirmError(null);
    setShowConfirmModal(true);
  };

  // Submit Confirm (UC08.2)
  const handleConfirmSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNotice) return;
    setConfirmError(null);

    // EF-01: Kiểm tra dữ liệu bắt buộc
    if (!txnCode.trim() || !receivedDate || !amountReceived) {
      setConfirmError('EF-01: Vui lòng nhập đầy đủ Số tiền thực nhận, Ngày nhận tiền và Mã giao dịch ngân hàng.');
      return;
    }

    // BR-UC08.2-03: Kiểm tra khớp đúng tổng tiền
    if (amountReceived !== selectedNotice.totalAmount) {
      setConfirmError(
        `BR-UC08.2-03: Số tiền thực nhận (${amountReceived.toLocaleString('vi-VN')} đ) phải bằng đúng 100% tổng tiền trên thông báo QR (${selectedNotice.totalAmount.toLocaleString('vi-VN')} đ). Không chấp nhận trả một phần, tiền mặt hoặc thừa/thiếu.`
      );
      return;
    }

    const bankStr = selectedNotice.qrBankSnapshot.bankName + ' - ' + selectedNotice.qrBankSnapshot.accountNumber;
    const res = confirmPaymentReceipt08_2(
      selectedNotice.id,
      amountReceived,
      receivedDate,
      txnCode.trim(),
      bankStr,
      proofFile.trim()
    );

    if (res.success) {
      setShowConfirmModal(false);
      alert(res.message);
      setActiveTab('uc08_2');
    } else {
      setConfirmError(res.message);
    }
  };

  // Submit Revert Receipt (AF-03 / BR-UC08.2-06, BR-UC08.2-10)
  const handleRevertSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReceipt) return;
    setRevertError(null);

    if (!revertReason.trim()) {
      setRevertError('EF-04 / BR-UC08.2-06: Lý do sửa xác nhận thu nhầm là trường bắt buộc.');
      return;
    }

    const res = revertPaymentReceipt08_2(selectedReceipt.id, revertReason.trim());
    if (res.success) {
      setShowRevertModal(false);
      setRevertReason('');
      alert(res.message);
    } else {
      setRevertError(res.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              Quy trình 08 (ASIS-08)
            </span>
            <h1 className="text-lg font-bold text-slate-900">Thu tiền & Đối soát Ngân hàng</h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Theo dõi tình trạng thanh toán (UC08.1) và Xác nhận giao dịch thực nhận vào tài khoản ngân hàng (UC08.2)
          </p>
        </div>

        {/* 2 Tabs Segmented Control */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold shrink-0">
          <button
            onClick={() => setActiveTab('uc08_1')}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'uc08_1' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            8.1. Theo dõi thanh toán (UC08.1)
          </button>
          <button
            onClick={() => setActiveTab('uc08_2')}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'uc08_2' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            8.2. Chứng từ & Sửa nhầm (UC08.2)
          </button>
        </div>
      </div>

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <span className="text-[11px] font-semibold text-slate-400 block">TỔNG PHẢI THU (ĐANG HIỆU LỰC)</span>
          <span className="text-lg font-bold font-mono text-slate-900 block mt-1">
            {totalReceivable.toLocaleString('vi-VN')} đ
          </span>
          <span className="text-[10px] text-slate-500 mt-0.5 block">{paymentNotices.filter(n => n.status === 'Đang hiệu lực').length} thông báo</span>
        </div>

        <div className="p-4 bg-white border border-emerald-200 bg-emerald-50/20 rounded-2xl shadow-xs">
          <span className="text-[11px] font-semibold text-emerald-700 block">ĐÃ THU ĐỦ VÀO NGÂN HÀNG</span>
          <span className="text-lg font-bold font-mono text-emerald-700 block mt-1">
            {totalCollected.toLocaleString('vi-VN')} đ
          </span>
          <span className="text-[10px] text-emerald-600 mt-0.5 block">Đã xác nhận tại UC08.2</span>
        </div>

        <div className="p-4 bg-white border border-amber-200 bg-amber-50/20 rounded-2xl shadow-xs">
          <span className="text-[11px] font-semibold text-amber-700 block">CÒN PHẢI THU (CHƯA THU)</span>
          <span className="text-lg font-bold font-mono text-amber-700 block mt-1">
            {totalUncollected.toLocaleString('vi-VN')} đ
          </span>
          <span className="text-[10px] text-amber-600 mt-0.5 block">Đang chờ khách chuyển khoản</span>
        </div>

        <div className="p-4 bg-white border border-red-200 bg-red-50/20 rounded-2xl shadow-xs">
          <span className="text-[11px] font-semibold text-red-700 block">THÔNG BÁO QUÁ HẠN</span>
          <span className="text-lg font-bold font-mono text-red-700 block mt-1">
            {overdueCount} thông báo
          </span>
          <span className="text-[10px] text-red-600 mt-0.5 block">Cần nhắc nợ tại QT09</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: 8.1. THEO DÕI THANH TOÁN (UC08.1)                                  */}
      {/* ========================================================================= */}
      {activeTab === 'uc08_1' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              {/* Room Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Phòng:</span>
                <select
                  value={roomFilter}
                  onChange={(e) => setRoomFilter(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg font-semibold text-slate-800"
                >
                  <option value="ALL">Tất cả phòng</option>
                  {uniqueRooms.map(r => (
                    <option key={r} value={r}>Phòng {r}</option>
                  ))}
                </select>
              </div>

              {/* Period Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Kỳ thu:</span>
                <select
                  value={periodFilter}
                  onChange={(e) => setPeriodFilter(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg font-semibold text-slate-800"
                >
                  <option value="ALL">Tất cả kỳ</option>
                  {uniquePeriods.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Notice Status Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Hiệu lực:</span>
                <select
                  value={noticeStatusFilter}
                  onChange={(e) => setNoticeStatusFilter(e.target.value as any)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg font-semibold text-slate-800"
                >
                  <option value="ALL">Tất cả</option>
                  <option value="ACTIVE">Đang hiệu lực</option>
                  <option value="REPLACED">Đã thay thế</option>
                </select>
              </div>

              {/* Payment Status Filter Buttons */}
              <div className="flex items-center gap-1 ml-auto">
                <span className="text-slate-500 font-medium mr-1">Trạng thái tiền:</span>
                {(['ALL', 'UNPAID', 'OVERDUE', 'PAID'] as const).map(st => (
                  <button
                    key={st}
                    onClick={() => setPaymentStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                      paymentStatusFilter === st
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {st === 'ALL' && 'Tất cả'}
                    {st === 'UNPAID' && 'Chưa thu'}
                    {st === 'OVERDUE' && 'Quá hạn'}
                    {st === 'PAID' && 'Đã thu'}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              BR-UC08.1-01: Hệ thống chỉ có 2 trạng thái thanh toán chính thức là <strong>Chưa thu</strong> và <strong>Đã thu</strong>. Nhãn <strong>Quá hạn</strong> là cảnh báo phụ khi Chưa thu và ngày hiện tại sau hạn thanh toán.
            </p>
          </div>

          {/* List of Notices Table / Cards */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="divide-y divide-slate-100 text-xs">
              {filteredNotices.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  Không tìm thấy thông báo thanh toán nào phù hợp với bộ lọc.
                </div>
              ) : (
                filteredNotices.map((n) => {
                  const isOverdue = n.paymentStatus === 'Chưa thu' && new Date(n.dueDate) < new Date();
                  const relatedReceipt = paymentReceipts.find(r => r.noticeId === n.id && r.status === 'Đang hiệu lực');

                  return (
                    <div
                      key={n.id}
                      className={`p-4 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                        n.status === 'Đã thay thế'
                          ? 'bg-slate-50/70 opacity-70'
                          : 'hover:bg-slate-50/80 bg-white'
                      }`}
                    >
                      {/* Left: Info */}
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 text-sm">{n.noticeCode}</span>
                          <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                            Phòng {n.roomCode}
                          </span>
                          <span className="font-mono text-slate-500">({n.periodCode})</span>

                          {/* Notice Status Badge */}
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            n.status === 'Đang hiệu lực' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600 line-through'
                          }`}>
                            {n.status}
                          </span>

                          {/* Overdue Badge (BR-UC08.1-01) */}
                          {isOverdue && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Quá hạn
                            </span>
                          )}

                          {/* Payment Status Badge */}
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            n.paymentStatus === 'Đã thu' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {n.paymentStatus}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-600 text-[11px] pt-1">
                          <div>
                            <span className="text-slate-400">1. Thuê tiếp theo: </span>
                            <span className="font-mono font-medium">
                              {n.breakdown?.nextRentAmount ? `${n.breakdown.nextRentAmount.toLocaleString('vi-VN')} đ` : '0 đ'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400">2. Dịch vụ vừa ở: </span>
                            <span className="font-mono font-medium">
                              {(n.totalAmount - (n.breakdown?.nextRentAmount || 0)).toLocaleString('vi-VN')} đ
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400">Hạn thanh toán: </span>
                            <strong className="font-mono text-slate-800">{n.dueDate}</strong>
                          </div>
                        </div>

                        {relatedReceipt && (
                          <div className="text-[11px] text-emerald-700 flex items-center gap-1.5 pt-0.5">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Đã thu ngày {relatedReceipt.receivedDate} (Mã GD: <strong className="font-mono">{relatedReceipt.transactionCode}</strong> · Người thu: {relatedReceipt.confirmedBy})</span>
                          </div>
                        )}

                        {n.status === 'Đã thay thế' && (
                          <p className="text-[11px] text-slate-500 italic">
                            AF-02: Bản này đã bị thay thế; chỉ dùng để tra cứu lịch sử, không cho phép xác nhận thu tiền bằng mã QR cũ.
                          </p>
                        )}
                      </div>

                      {/* Right: Amount & Action */}
                      <div className="flex flex-col md:items-end justify-between gap-2 shrink-0">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block">Tổng tiền QR:</span>
                          <span className="text-base font-bold font-mono text-blue-700">
                            {n.totalAmount.toLocaleString('vi-VN')} đ
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setInspectNotice(n)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Chi tiết
                          </button>

                          {n.status === 'Đang hiệu lực' && n.paymentStatus === 'Chưa thu' && (
                            <button
                              onClick={() => openConfirmModal(n)}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Xác nhận thu đủ (UC08.2)
                            </button>
                          )}

                          {n.status === 'Đang hiệu lực' && n.paymentStatus === 'Đã thu' && relatedReceipt && (
                            <button
                              onClick={() => {
                                setSelectedReceipt(relatedReceipt);
                                setRevertReason('');
                                setShowRevertModal(true);
                              }}
                              className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg font-semibold text-xs flex items-center gap-1 cursor-pointer"
                              title="Sửa xác nhận thu nhầm (AF-03)"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Sửa thu nhầm
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: 8.2. CHỨNG TỪ & SỬA NHẦM (UC08.2)                                  */}
      {/* ========================================================================= */}
      {activeTab === 'uc08_2' && (
        <div className="space-y-4">
          <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800">UC08.2: Sổ theo dõi chứng từ thu tiền ngân hàng</h2>
              <p className="text-xs text-slate-500">
                Ghi nhận chứng từ xác nhận chuyển khoản ngân hàng. Cho phép sửa xác nhận thu nhầm với lý do bắt buộc và lưu toàn bộ lịch sử (AF-03).
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500 font-semibold">
              Tổng số chứng từ: {paymentReceipts.length}
            </span>
          </div>

          {/* List of Receipts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paymentReceipts.length === 0 ? (
              <div className="col-span-2 py-16 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200">
                Chưa có chứng từ thu tiền nào được xác nhận.
              </div>
            ) : (
              paymentReceipts.map((r) => {
                const isInvalid = r.status === 'Không còn hiệu lực';

                return (
                  <div
                    key={r.id}
                    className={`p-4 rounded-2xl border text-xs space-y-3 ${
                      isInvalid
                        ? 'bg-red-50/40 border-red-200 opacity-80'
                        : 'bg-white border-slate-200 shadow-xs'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 text-sm">{r.transactionCode}</span>
                        <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                          Phòng {r.roomCode}
                        </span>
                      </div>

                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        r.status === 'Đang hiệu lực'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-800 line-through'
                      }`}>
                        {r.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-slate-600 text-[11px] bg-slate-50 p-2.5 rounded-xl">
                      <div>Số tiền: <strong className="font-mono text-blue-800 text-xs block">{r.amountReceived.toLocaleString('vi-VN')} đ</strong></div>
                      <div>Ngày nhận: <span className="font-mono text-slate-800 font-semibold block">{r.receivedDate}</span></div>
                      <div className="col-span-2">Tài khoản nhận: <span className="font-mono text-slate-800 block">{r.bankAccountReceived}</span></div>
                      <div>Người xác nhận: <span className="font-semibold text-slate-800 block">{r.confirmedBy}</span></div>
                      <div>Phương thức: <span className="text-emerald-700 font-medium block">Chuyển khoản NH</span></div>
                    </div>

                    {isInvalid && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-1 text-red-900 text-[11px]">
                        <div className="flex items-center gap-1 font-bold text-red-800">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Chứng từ đã bị hủy hiệu lực (Sửa thu nhầm):</span>
                        </div>
                        <p><strong>Lý do:</strong> {r.invalidatedReason}</p>
                        <p className="text-[10px] text-red-700">
                          Thời gian hủy: {new Date(r.invalidatedAt || '').toLocaleString('vi-VN')} · Người hủy: {r.invalidatedBy || 'Chủ nhà'}
                        </p>
                      </div>
                    )}

                    {!isInvalid && (
                      <div className="flex justify-end pt-1 border-t border-slate-100">
                        <button
                          onClick={() => {
                            setSelectedReceipt(r);
                            setRevertReason('');
                            setShowRevertModal(true);
                          }}
                          className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Sửa xác nhận thu nhầm (AF-03)
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONFIRM RECEIPT (UC08.2)                                           */}
      {/* ========================================================================= */}
      {showConfirmModal && selectedNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Xác nhận thu tiền chuyển khoản (UC08.2)</h3>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {confirmError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-[11px] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{confirmError}</span>
              </div>
            )}

            {/* Notice Quick Card */}
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1.5 text-slate-700">
              <div className="flex justify-between">
                <span>Thông báo thu tiền:</span>
                <strong className="font-mono text-slate-900">{selectedNotice.noticeCode}</strong>
              </div>
              <div className="flex justify-between">
                <span>Phòng & Kỳ:</span>
                <strong>Phòng {selectedNotice.roomCode} - {selectedNotice.periodCode}</strong>
              </div>
              <div className="flex justify-between">
                <span>Tài khoản nhận tiền:</span>
                <span className="font-mono">{selectedNotice.qrBankSnapshot.bankName} - {selectedNotice.qrBankSnapshot.accountNumber}</span>
              </div>
              <div className="flex justify-between font-bold text-blue-900 pt-1.5 border-t border-blue-200 text-sm">
                <span>Tổng tiền yêu cầu trên QR:</span>
                <span className="font-mono text-base">{selectedNotice.totalAmount.toLocaleString('vi-VN')} đ</span>
              </div>
            </div>

            {/* Form Fields */}
            <form onSubmit={handleConfirmSubmit} className="space-y-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Số tiền thực nhận vào tài khoản (đ) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold text-blue-700 text-sm"
                />
                <span className="text-[10px] text-slate-400 block mt-1">
                  BR-UC08.2-03: Chỉ xác nhận khi tiền thực vào tài khoản đúng đủ số của QR. Không hỗ trợ chuyển thiếu/thừa hoặc thanh toán một phần.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Ngày nhận tiền <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={receivedDate}
                    onChange={(e) => setReceivedDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Mã giao dịch ngân hàng <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={txnCode}
                    onChange={(e) => setTxnCode(e.target.value)}
                    placeholder="Ví dụ: FT261016..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Chứng từ giao dịch (tùy chọn)
                </label>
                <input
                  type="text"
                  value={proofFile}
                  onChange={(e) => setProofFile(e.target.value)}
                  placeholder="Tên file ảnh giao dịch ngân hàng..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer shadow-xs"
                >
                  Xác nhận đã thu đủ (UC08.2)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REVERT RECEIPT (AF-03 / BR-UC08.2-06, BR-UC08.2-10)               */}
      {/* ========================================================================= */}
      {showRevertModal && selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Sửa xác nhận thu nhầm (AF-03)</h3>
              <button
                onClick={() => setShowRevertModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {revertError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-[11px] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{revertError}</span>
              </div>
            )}

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-1.5 text-[11px]">
              <p className="font-bold">Quy tắc nghiệp vụ sửa thu nhầm (BR-UC08.2-06 & 10):</p>
              <p>
                Hệ thống <strong>giữ lại bản ghi chứng từ cũ trong lịch sử</strong> và đánh dấu <strong>Không còn hiệu lực</strong>, chuyển thông báo và các khoản thu liên quan về trạng thái <strong>Chưa thu</strong>, sau đó tính lại công nợ và báo cáo.
              </p>
            </div>

            <div className="p-2.5 bg-slate-100 rounded-xl space-y-1 text-slate-700">
              <div>Mã giao dịch hủy: <strong className="font-mono text-slate-900">{selectedReceipt.transactionCode}</strong></div>
              <div>Số tiền: <strong className="font-mono text-blue-800">{selectedReceipt.amountReceived.toLocaleString('vi-VN')} đ</strong> (Phòng {selectedReceipt.roomCode})</div>
              <div>Ngày ghi nhận ban đầu: <span className="font-mono">{selectedReceipt.receivedDate}</span></div>
            </div>

            <form onSubmit={handleRevertSubmit} className="space-y-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Lý do sửa xác nhận thu nhầm <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={revertReason}
                  onChange={(e) => setRevertReason(e.target.value)}
                  rows={3}
                  required
                  placeholder="Bắt buộc nhập lý do (Ví dụ: Thao tác nhầm nút, ngân hàng đối soát chưa vào tiền, tra soát lại giao dịch khách báo nhầm...)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowRevertModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold cursor-pointer shadow-xs"
                >
                  Xác nhận hủy hiệu lực chứng từ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: INSPECT NOTICE DETAIL                                              */}
      {/* ========================================================================= */}
      {inspectNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-bold text-slate-900 text-base">Chi tiết thông báo {inspectNotice.noticeCode}</h3>
              <button
                onClick={() => setInspectNotice(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-slate-700">
              <div className="flex justify-between">
                <span>Phòng & Kỳ:</span> <strong>Phòng {inspectNotice.roomCode} · {inspectNotice.periodCode}</strong>
              </div>
              <div className="flex justify-between">
                <span>Trạng thái hiệu lực:</span> <span className="font-bold">{inspectNotice.status}</span>
              </div>
              <div className="flex justify-between">
                <span>Trạng thái thanh toán:</span> <span className="font-bold text-emerald-700">{inspectNotice.paymentStatus}</span>
              </div>
              <div className="flex justify-between">
                <span>Hạn thanh toán:</span> <span className="font-mono font-bold">{inspectNotice.dueDate}</span>
              </div>

              <div className="p-3 bg-slate-100 rounded-xl space-y-1">
                <span className="font-bold text-slate-900 block">Tài khoản nhận tiền ghi nhận lúc tạo:</span>
                <div>Ngân hàng: <strong>{inspectNotice.qrBankSnapshot.bankName}</strong></div>
                <div>Số tài khoản: <strong className="font-mono text-blue-700">{inspectNotice.qrBankSnapshot.accountNumber}</strong></div>
                <div>Chủ tài khoản: <span className="uppercase">{inspectNotice.qrBankSnapshot.accountHolder}</span></div>
                <div>Nội dung CK: <strong className="font-mono text-red-700">{inspectNotice.qrBankSnapshot.transferContent}</strong></div>
              </div>

              <div className="flex justify-between font-bold text-blue-900 text-sm pt-2 border-t border-slate-200">
                <span>Tổng tiền QR cố định:</span>
                <span>{inspectNotice.totalAmount.toLocaleString('vi-VN')} đ</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setInspectNotice(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl font-semibold cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
