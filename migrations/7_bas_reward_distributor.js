const {
  basPools,
  INITIAL_BAS_FOR_DAI_BAC,
  INITIAL_BAS_FOR_DAI_BAS,
  STARTING_AMOUNT_FOR_DAI_BAS,
} = require('./pools');

// Pools
// deployed first
const Share = artifacts.require('Share');
const InitialDAIBACDistributor = artifacts.require('InitialDAIBACDistributor');
const InitialDAIBASDistributor = artifacts.require('InitialDAIBASDistributor');

// ============ Main Migration ============

async function migration(deployer, network, accounts) {
  const unit = web3.utils.toBN(10 ** 18);
  const totalBalanceForDAIBAC = unit.muln(INITIAL_BAS_FOR_DAI_BAC).toString();
  const totalBalanceForDAIBAS = unit.muln(INITIAL_BAS_FOR_DAI_BAS).toString();
  const startingAmountForDAIBAS = unit.muln(STARTING_AMOUNT_FOR_DAI_BAS).toString();

  const share = await Share.deployed();
  const period = network === 'mainnet'
    ? 86400  // distributed throughout 5 days on mainnet
    : 1;     // fast-rewind on testnet

  const deflation = {
    rate: network === 'mainnet' ? 75 : 50,
    interval: network === 'mainnet' ? 30 : 1,
  }

  const lpPoolDAIBAC = artifacts.require(basPools.DAIBAC.contractName);
  // Deploy DAIBAC Distributor
  await deployer.deploy(
    InitialDAIBACDistributor,
    share.address,
    lpPoolDAIBAC.address,
    totalBalanceForDAIBAC,
    period,
  );
  const daibacDistributor = await InitialDAIBACDistributor.deployed();

  console.log(`Setting distributor to InitialDAIBACDistributor (${daibacDistributor.address})`);
  await lpPoolDAIBAC.deployed().then(pool => pool.setRewardDistribution(daibacDistributor.address));

  await share.mint(daibacDistributor.address, totalBalanceForDAIBAC);
  console.log(`Deposited ${INITIAL_BAS_FOR_DAI_BAC} BAS to InitialDAIBACDistributor.`);

  const lpPoolDAIBAS = artifacts.require(basPools.DAIBAS.contractName);
  // Deploy DAIBAS Distributor
  await deployer.deploy(
    InitialDAIBASDistributor,
    share.address,
    lpPoolDAIBAS.address,
    totalBalanceForDAIBAS,
    startingAmountForDAIBAS,
    deflation.rate,
    deflation.interval,
    period,
  );
  const daibasDistributor = await InitialDAIBASDistributor.deployed();

  console.log(`Setting distributor to InitialDAIBASDistributor (${daibasDistributor.address})`);
  await lpPoolDAIBAS.deployed().then(pool => pool.setRewardDistribution(daibasDistributor.address));

  await share.mint(daibasDistributor.address, totalBalanceForDAIBAS);
  console.log(`Deposited ${INITIAL_BAS_FOR_DAI_BAS} BAS to InitialDAIBASDistributor.`);

  if (network !== 'mainnet') {
    // unit period is set as a second on testnet,
    // so calling performDailyDistribution() will distribute entire balance instantly
    console.log('Distributing initial Basis Share instantly for test...');
    await Promise.all([
      daibacDistributor.performDailyDistribution(),
      daibasDistributor.performDailyDistribution(),
    ]);
  } else {
    console.log('NOTES ON MAINNET LAUNCH:')
    console.log(`  performDailyDistribution() should be called at most once a day for distribution to BAS pools.`);
  }
  console.log('=================================');
}

module.exports = migration;