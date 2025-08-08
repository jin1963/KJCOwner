let web3, account, auto, ownerOnChain;

// ===== helpers =====
const ERC20_ABI = ERC20_MINI_ABI; // จาก config.js (balanceOf/decimals)
const MAX_UINT = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

function ctrERC20(a){ return new web3.eth.Contract(ERC20_ABI, a); }
function fmtWei(bn){ return Web3.utils.fromWei(bn,'ether'); }
function toWeiDec(x, dec=18){
  // แปลงจำนวนทศนิยมตาม decimals → เป็นสตริง BN
  const n = Number(x);
  if (!isFinite(n) || n <= 0) return '0';
  if (dec === 18) return Web3.utils.toWei(String(n), 'ether');
  return (BigInt(Math.round(n * (10 ** dec)))).toString(); // best effort
}

async function isOwner(){
  const o = await auto.methods.owner().call();
  ownerOnChain = o;
  document.getElementById('ownerAddr').textContent = o;
  return account && o && (account.toLowerCase() === o.toLowerCase());
}

async function refreshBalances(){
  // BNB
  const bnb = await web3.eth.getBalance(CONFIG.autoStaker);
  document.getElementById('balBNB').textContent = Number(fmtWei(bnb)).toFixed(6);

  // KJC
  const kjcBal = await ctrERC20(CONFIG.kjc).methods.balanceOf(CONFIG.autoStaker).call();
  document.getElementById('balKJC').textContent = Number(fmtWei(kjcBal)).toFixed(6);

  // USDT
  const usdtBal = await ctrERC20(CONFIG.usdt).methods.balanceOf(CONFIG.autoStaker).call();
  document.getElementById('balUSDT').textContent = Number(fmtWei(usdtBal)).toFixed(6);
}

async function connect(){
  try{
    if(!window.ethereum){ alert('กรุณาติดตั้ง MetaMask'); return; }
    web3 = new Web3(window.ethereum);
    await ethereum.request({method:'eth_requestAccounts'});
    const chainId = await ethereum.request({method:'eth_chainId'});
    if (chainId !== CONFIG.chainIdHex){
      await ethereum.request({method:'wallet_switchEthereumChain', params:[{chainId:CONFIG.chainIdHex}]});
    }
    [account] = await web3.eth.getAccounts();
    document.getElementById('status').textContent = `✅ ${account}`;
    document.getElementById('contractAddr').textContent = CONFIG.autoStaker;

    auto = new web3.eth.Contract(AUTO_STAKER_ABI, CONFIG.autoStaker);
    const ownerOK = await isOwner();

    if(!ownerOK){
      document.getElementById('ownerWarn').style.display='block';
      // disable all action buttons
      ['btnWithdrawKJC','btnRescueToken','btnRescueBNB','btnKJCMax','btnTokenMax','btnBNBMax']
        .forEach(id=>{ const el=document.getElementById(id); if(el) el.disabled = true; });
    }

    if (ethereum && ethereum.on){
      ethereum.on('accountsChanged', ()=>location.reload());
      ethereum.on('chainChanged', ()=>location.reload());
    }

    refreshBalances();
  }catch(e){
    console.error(e);
    alert('เชื่อมต่อไม่สำเร็จ');
  }
}

// ===== actions =====
async function withdrawKJC(){
  try{
    const val = document.getElementById('amtKJC').value.trim();
    if(!val || Number(val)<=0) return alert('กรอกจำนวน KJC');
    const wei = toWeiDec(val, 18);
    await auto.methods.withdrawRemainingKJC(wei).send({from:account});
    alert('ถอน KJC สำเร็จ');
    refreshBalances();
  }catch(e){ console.error(e); alert('ถอน KJC ไม่สำเร็จ'); }
}

async function rescueToken(){
  try{
    let token = document.getElementById('tokenAddr').value.trim();
    if (!token) token = CONFIG.usdt; // default = USDT
    if(!Web3.utils.isAddress(token)) return alert('token address ไม่ถูกต้อง');

    const val = document.getElementById('amtToken').value.trim();
    if(!val || Number(val)<=0) return alert('กรอกจำนวน token');

    let dec = 18;
    try{ dec = await ctrERC20(token).methods.decimals().call(); }catch{}
    const amt = toWeiDec(val, Number(dec));

    await auto.methods.rescueTokens(token, amt).send({from:account});
    alert('ถอน Token สำเร็จ');
    refreshBalances();
  }catch(e){ console.error(e); alert('ถอน Token ไม่สำเร็จ'); }
}

async function rescueBNB(){
  try{
    const val = document.getElementById('amtBNB').value.trim();
    if(!val || Number(val)<=0) return alert('กรอกจำนวน BNB');
    const wei = Web3.utils.toWei(val,'ether');
    await auto.methods.rescueBNB(wei).send({from:account});
    alert('ถอน BNB สำเร็จ');
    refreshBalances();
  }catch(e){ console.error(e); alert('ถอน BNB ไม่สำเร็จ'); }
}

// ===== MAX helpers =====
async function fillMaxKJC(){
  const bal = await ctrERC20(CONFIG.kjc).methods.balanceOf(CONFIG.autoStaker).call();
  document.getElementById('amtKJC').value = Number(fmtWei(bal));
}
async function fillMaxToken(){
  let token = document.getElementById('tokenAddr').value.trim();
  if (!token) token = CONFIG.usdt;
  const ctr = ctrERC20(token);
  const bal = await ctr.methods.balanceOf(CONFIG.autoStaker).call();
  let dec = 18;
  try{ dec = await ctr.methods.decimals().call(); }catch{}
  if (Number(dec) === 18) {
    document.getElementById('amtToken').value = Number(fmtWei(bal));
  } else {
    document.getElementById('amtToken').value = Number(bal) / (10 ** Number(dec));
  }
}
async function fillMaxBNB(){
  const bal = await web3.eth.getBalance(CONFIG.autoStaker);
  document.getElementById('amtBNB').value = Number(fmtWei(bal));
}

// ===== bind UI =====
document.getElementById('btnConnect').onclick     = connect;
document.getElementById('btnRefresh').onclick     = refreshBalances;
document.getElementById('btnWithdrawKJC').onclick = withdrawKJC;
document.getElementById('btnRescueToken').onclick = rescueToken;
document.getElementById('btnRescueBNB').onclick   = rescueBNB;
document.getElementById('btnKJCMax').onclick      = fillMaxKJC;
document.getElementById('btnTokenMax').onclick    = fillMaxToken;
document.getElementById('btnBNBMax').onclick      = fillMaxBNB;
