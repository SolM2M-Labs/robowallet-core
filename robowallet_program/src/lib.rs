use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("896w2abQMjM5KGABmDL8uuxhCCyF2GtwAL6rGPgeJxN4");

#[program]
pub mod robowallet_program {
    use super::*;

    /// Initialize a new Session Key Vault (PDA) for a specific hardware device
    pub fn initialize_session(
        ctx: Context<InitializeSession>,
        device_key: Pubkey,
        spending_limit: u64,
    ) -> Result<()> {
        let session_state = &mut ctx.accounts.session_state;
        
        session_state.owner = ctx.accounts.owner.key();
        session_state.device_key = device_key;
        session_state.spending_limit = spending_limit;
        session_state.total_spent = 0;
        session_state.bump = ctx.bumps.session_state;

        msg!("RoboWallet Session Vault Initialized!");
        msg!("Device Pubkey: {}", device_key);
        msg!("Spending Limit: {} lamports", spending_limit);

        Ok(())
    }

    /// The hardware device calls this to execute a payment from the Vault
    pub fn execute_payment(
        ctx: Context<ExecutePayment>,
        amount: u64,
    ) -> Result<()> {
        let session_state = &mut ctx.accounts.session_state;

        // 1. Verify the signer is the authorized hardware device
        require!(
            ctx.accounts.device_signer.key() == session_state.device_key,
            ErrorCode::UnauthorizedDevice
        );

        // 2. Enforce the spending limit
        require!(
            session_state.total_spent + amount <= session_state.spending_limit,
            ErrorCode::SpendingLimitExceeded
        );

        // 3. Update state
        session_state.total_spent += amount;

        // 4. Transfer funds from PDA Vault to Target
        let bump = session_state.bump;
        let owner_key = session_state.owner;
        let device_key = session_state.device_key;
        
        let seeds = &[
            b"session",
            owner_key.as_ref(),
            device_key.as_ref(),
            &[bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_context = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: session_state.to_account_info(), // The PDA vault
                to: ctx.accounts.target.to_account_info(),
            },
            signer,
        );

        system_program::transfer(cpi_context, amount)?;

        msg!("M2M Payment Executed: {} lamports", amount);
        Ok(())
    }

    /// Close an existing Session Key Vault (PDA) and recover the rent lamports
    pub fn close_session(ctx: Context<CloseSession>) -> Result<()> {
        msg!("Session PDA Vault closed. Rent returned to owner: {}", ctx.accounts.owner.key());
        Ok(())
    }
}

// ================== ACCOUNTS & CONTEXTS ==================

#[derive(Accounts)]
#[instruction(device_key: Pubkey)]
pub struct InitializeSession<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + SessionState::INIT_SPACE,
        seeds = [b"session", owner.key().as_ref(), device_key.as_ref()],
        bump
    )]
    pub session_state: Account<'info, SessionState>,
    
    #[account(mut)]
    pub owner: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExecutePayment<'info> {
    #[account(
        mut,
        seeds = [b"session", session_state.owner.as_ref(), session_state.device_key.as_ref()],
        bump = session_state.bump
    )]
    pub session_state: Account<'info, SessionState>,

    /// The ESP32 device acting as the signer
    pub device_signer: Signer<'info>,

    /// The recipient of the funds (e.g. charging pad)
    #[account(mut)]
    /// CHECK: Target can be any pubkey, it's just receiving funds
    pub target: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseSession<'info> {
    #[account(
        mut,
        seeds = [b"session", session_state.owner.as_ref(), session_state.device_key.as_ref()],
        bump = session_state.bump,
        close = owner
    )]
    pub session_state: Account<'info, SessionState>,

    #[account(mut, address = session_state.owner)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

// ================== STATE ==================

#[account]
#[derive(InitSpace)]
pub struct SessionState {
    pub owner: Pubkey,          // 32
    pub device_key: Pubkey,     // 32
    pub spending_limit: u64,    // 8
    pub total_spent: u64,       // 8
    pub bump: u8,               // 1
}

// ================== ERRORS ==================

#[error_code]
pub enum ErrorCode {
    #[msg("The signer does not match the authorized device key.")]
    UnauthorizedDevice,
    #[msg("The requested payment exceeds the session spending limit.")]
    SpendingLimitExceeded,
}
