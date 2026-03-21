import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import 'dotenv/config'

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })

  console.log(' Test with 3-minute delay...')

  try {
    // 1. CREATE DATA
    console.log('\n--- PHASE 1: CREATING DATA ---')
    const newKey = await prisma.apiKey.create({
      data: {
        key: 'test_key_' + Date.now(),
        wallet: '0xTestWallet_' + Date.now(),
        plan: 'PREMIUM'
      }
    })
    console.log(' Created ApiKey:', newKey.id)

    const newPayment = await prisma.payment.create({
      data: {
        wallet: '0xTestWallet_' + Date.now(),
        amount: 1.5,
        chain: 'solana',
        txHash: '0xHash_' + Date.now()
      }
    })
    console.log(' Created Payment:', newPayment.id)

    // 2. WAIT
    console.log('\n--- PHASE 2: WAITING 3 MINUTES ---')
    console.log('Check your Supabase Dashboard now! Data is live.');
    
    let secondsLeft = 180;
    const interval = setInterval(() => {
        secondsLeft -= 30;
        if (secondsLeft > 0) console.log('⏳ ' + secondsLeft + ' seconds remaining...');
    }, 30000);

    await delay(180000); // 3 minutes
    clearInterval(interval);

    // 3. DELETE DATA
    console.log('\n--- PHASE 3: CLEANING UP ---')
    await prisma.apiKey.delete({ where: { id: newKey.id } })
    console.log(' Deleted ApiKey.')

    await prisma.payment.delete({ where: { id: newPayment.id } })
    console.log(' Deleted Payment.')

    console.log('\n Test finished successfully!')
  } catch (e) {
    console.error('\n Test failed!', e)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main()
