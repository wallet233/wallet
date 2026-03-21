import prisma from './src/config/database.js';

async function testConnection() {
  console.log('🐘 Connecting to WIP Protocol Database...');
  try {
    await prisma.$connect();
    console.log('✅ Connection Successful!');
    
    // Test a real read
    const count = await prisma.payment.count();
    console.log(`✅ Table Check: Found ${count} payments.`);
    
    console.log('\n🚀 SYSTEM ONLINE');
  } catch (error: any) {
    console.error('\n❌ INITIALIZATION FAILED:');
    console.error(error.message);
  } finally {
    await prisma.$disconnect();
  }
}
testConnection();
