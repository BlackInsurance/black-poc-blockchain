'use strict';
/**
 * Transactions for the Insurance Game POC
 */

var X = "@DEBUG";



/*
transaction InvestInSyndicate {
    o Double investmentAmount
    --> PlatformUser investor
    --> Syndicate syndicate
  }
*/  

/**
 * Allows an investor to invest in a Syndicate
 * @param {insure.black.poc.InvestInSyndicate} syndicateInvestment
 * @transaction 
 */
function onInvestInSyndicate(syndicateInvestment) {

    if(syndicateInvestment.investor.type !== "Investor"){
        throw new Error('Bad transaction request.  The PlatformUser (transaction.investor) is not actually an Investor.  PlatformUser.type = "' + syndicateInvestment.investor.type + '"');
    }
    if(syndicateInvestment.investor.balanceBLCK < syndicateInvestment.investmentAmount){
        throw new Error('Bad transaction request.  The Investor does not have enough BLCK to complete this transaction.  Current BLCK Balance = "' + syndicateInvestment.investor.balanceBLCK + '", Requested Investment = "' + syndicateInvestment.investmentAmount + '"');
    }
    var currentParticipant = getCurrentParticipant();
    if (currentParticipant.getFullyQualifiedIdentifier() !== syndicateInvestment.investor.getFullyQualifiedIdentifier()) {
        throw new Error('Bad transaction request.  An Investor can only submit this transaction for themself; they cannot submit investment transactions for other Investors.');
    }

    var platformUserRegistry, syndicateRegistry, paymentRegistry, obligationRegistry;
    var factory = getFactory();
    var serializer = getSerializer();

    return Promise.all([
        getParticipantRegistry('insure.black.poc.PlatformUser'),
        getParticipantRegistry('insure.black.poc.Syndicate'),
        getAssetRegistry('insure.black.poc.Payment'),
        getAssetRegistry('insure.black.poc.Obligation')
    ]).then(function(registries){
        platformUserRegistry = registries[0];
        syndicateRegistry = registries[1];
        paymentRegistry = registries[2];
        obligationRegistry = registries[3];

        var transactionDate = new Date();
        var datestring = transactionDate.getFullYear() + ("0"+(transactionDate.getMonth()+1)).slice(-2) + ("0" + transactionDate.getDate()).slice(-2) + ("0" + transactionDate.getHours()).slice(-2) + ("0" + transactionDate.getMinutes()).slice(-2);

        // Investor invests in the Syndicate
        var investorPayment = factory.newResource('insure.black.poc', 'Payment', 'PAYMENT_'+syndicateInvestment.investor.participantID.toString()+'_TO_SYNDICATE-'+datestring);
        investorPayment.amount = syndicateInvestment.investmentAmount;
        investorPayment.date = transactionDate;
        investorPayment.from = syndicateInvestment.investor;
        investorPayment.to = syndicateInvestment.syndicate;
        investorPayment.approved = true;
        
        syndicateInvestment.investor.balanceBLCK = (syndicateInvestment.investor.balanceBLCK - syndicateInvestment.investmentAmount);
        syndicateInvestment.syndicate.balanceBLCK = (syndicateInvestment.syndicate.balanceBLCK + syndicateInvestment.investmentAmount);

        // Syndicate creates an Obligation to the Investor
        var investorObligation = factory.newResource('insure.black.poc', 'Obligation', 'OBLIGATON_TO_'+syndicateInvestment.investor.participantID.toString()+'-'+datestring);
        investorObligation.amount = syndicateInvestment.investmentAmount;
        investorObligation.date = transactionDate;
        investorObligation.obligee = syndicateInvestment.investor;
        if(syndicateInvestment.syndicate.debtsToInvestors==null){syndicateInvestment.syndicate.debtsToInvestors = new Array();}
        syndicateInvestment.syndicate.debtsToInvestors[syndicateInvestment.syndicate.debtsToInvestors.length] = investorObligation;

        return Promise.all([
            paymentRegistry.add(investorPayment),
            obligationRegistry.add(investorObligation),
            platformUserRegistry.update(syndicateInvestment.investor),
            syndicateRegistry.update(syndicateInvestment.syndicate)
        ]);
    }).then(function(){
        // Success, the Investment in the Syndicate is complete
        return true;
    }).catch(function(err){
        console.log(X+' - FOUND AN ERROR');
        console.log(X+err.toString());
        throw err;
    });
}


/*
transaction UnderwritePolicies {
    o Double underwritingAmount
    --> Syndicate syndicate
    --> InsuranceAgency agency
  }
*/ 

/**
 * Allows a Syndicate to Underwrite Policies sold by an Insurance Agency
 * @param {insure.black.poc.UnderwritePolicies} policyUnderwriting
 * @transaction 
 */
function onUnderwritePolicies(policyUnderwriting) {

    if(policyUnderwriting.underwritingAmount <= 0){
        throw new Error('Bad transaction request.  The amount of Policy sales to be underwritten by this Syndicate must be greater than 0. Requested Amount = "' + syndicateInvestment.underwritingAmount + '"');
    }
    var currentParticipant = getCurrentParticipant();
    if (currentParticipant.getFullyQualifiedIdentifier() !== policyUnderwriting.syndicate.manager.getFullyQualifiedIdentifier()) {
        throw new Error('Bad transaction request.  Only the SyndicateManager can submit this transaction for this Syndicate.');
    }

    var agencyRegistry, syndicateRegistry, obligationRegistry;
    var factory = getFactory();

    return Promise.all([
        getParticipantRegistry('insure.black.poc.InsuranceAgency'),
        getParticipantRegistry('insure.black.poc.Syndicate'),
        getAssetRegistry('insure.black.poc.Obligation')
    ]).then(function(registries){
        agencyRegistry = registries[0];
        syndicateRegistry = registries[1];
        obligationRegistry = registries[2];

        var transactionDate = new Date();
        var datestring = transactionDate.getFullYear() + ("0"+(transactionDate.getMonth()+1)).slice(-2) + ("0" + transactionDate.getDate()).slice(-2) + ("0" + transactionDate.getHours()).slice(-2) + ("0" + transactionDate.getMinutes()).slice(-2);

        // Syndicate gives Black Insurance Agency reserve funds (underwriting)
        var syndicateObligation = factory.newResource('insure.black.poc', 'Obligation', 'OBLIGATON_TO_BLACK_INSURANCE_AGENCY');
        syndicateObligation.amount = policyUnderwriting.underwritingAmount;
        syndicateObligation.date = transactionDate;
        syndicateObligation.obligee = policyUnderwriting.agency;
        policyUnderwriting.syndicate.fundsBoundToAgency = syndicateObligation;
        policyUnderwriting.agency.policyUnderwriter = policyUnderwriting.syndicate;

        return Promise.all([
            obligationRegistry.add(syndicateObligation),
            syndicateRegistry.update(policyUnderwriting.syndicate),
            agencyRegistry.update(policyUnderwriting.agency)
        ]);
    }).then(function(){
        // Success, the Syndicate underwriting the Insurance Agency is complete
        return true;
    }).catch(function(err){
        console.log(X+' - FOUND AN ERROR');
        console.log(X+err.toString());
        throw err;
    });
}


/*  
transaction IssueNewPolicy {
    o DateTime startDate
    o DateTime endDate default="2018-08-01T00:00:00"
    o String coveredCity
    o Double latitude
    o Double longitude
    o String policyID
    o String productID default="RAINY_DAY_INSURANCE"
    o String policyHolderID}
*/

/**
 * Issue a new 'Rainy Day' insurance policy
 * @param {insure.black.poc.IssueNewPolicy} newIssuedPolicy
 * @transaction 
 */
function onIssueNewPolicy(newIssuedPolicy) {
    var policyRegistry, productRegistry, platformUserRegistry;
    var product, policy, policyHolder, transactionRequestingUser;
    var factory = getFactory();

    // Validate the inputs
  	transactionRequestingUser = getCurrentParticipant();
    if (transactionRequestingUser.getFullyQualifiedIdentifier() !== 'insure.black.poc.PlatformUser#BROKER') {
      throw new Error('Transaction can only be submitted by BROKER');
    }
  	

    
    // Load the Registries for different data types
    return Promise.all([
        getAssetRegistry('insure.black.poc.Policy'),
        getAssetRegistry('insure.black.poc.Product'),
        getParticipantRegistry('insure.black.poc.PlatformUser')
    ]).then(function(registries){
        policyRegistry = registries[0];
        productRegistry = registries[1];
        platformUserRegistry = registries[2];

        console.log(X+'----------------------------------');
        console.log(X+newIssuedPolicy.policyHolderID);

        // Retrieve the PolicyHolder
        return platformUserRegistry.get(newIssuedPolicy.policyHolderID);
    }).then(function(ph){
        policyHolder = ph;

        console.log(X+'----------------------------------');
        console.log(X+newIssuedPolicy.productID);

        // Retrieve the Product
        return productRegistry.get(newIssuedPolicy.productID);
    }).then(function(pr){
        product = pr;

        console.log(X+'----------------------------------');
        console.log(X+newIssuedPolicy.policyID);

        var transactionDate = new Date();
        var datestring = transactionDate.getFullYear() + ("0"+(transactionDate.getMonth()+1)).slice(-2) + ("0" + transactionDate.getDate()).slice(-2) + ("0" + transactionDate.getHours()).slice(-2) + ("0" + transactionDate.getMinutes()).slice(-2);

        // Current User (broker) will issue a new Policy to the PolicyHolder
        policy = factory.newResource('insure.black.poc', 'Policy', newIssuedPolicy.policyID);
        policy.createDate = new Date();
        policy.startDate = newIssuedPolicy.startDate;
        policy.endDate = newIssuedPolicy.endDate;
        policy.coveredCity = newIssuedPolicy.coveredCity;
        policy.latitude = newIssuedPolicy.latitude;
        policy.longitude = newIssuedPolicy.longitude;
        policy.product = product;
        policy.policyHolder = policyHolder;
        policy.issuingBroker = transactionRequestingUser;

        console.log(X+'----------------------------------');
        console.log(X+policy.policyID);
      
        return policyRegistry.add(policy);
    }).then(function(success){

        console.log(X+'----------------------------------');
        console.log(X+success);
      
        // Success, the PolicyHolder owns a new Policy on the Blockchain
        var policyIssuedEvent = factory.newEvent('insure.black.poc', 'NewPolicyIssued');
        policyIssuedEvent.policyID = policy.policyID;
        policyIssuedEvent.policyHolderID = policyHolder.participantID;
        emit(policyIssuedEvent);

        console.log(X+'----------------------------------');
        console.log(X+policyIssuedEvent);
      
      	return Promise.resolve(true);
    }).catch(function(err){
        console.log(X+' - FOUND AN ERROR');
        console.log(X+err.toString());
        throw err;
    });
}








/*


asset Claim identified by claimID {
  o String claimID
  o DateTime claimDate
  o Double rainLast24Hours default=0.0
  o Double cloudsLast24Hours default=0.0
  o Double highTempLast24Hours default=0.0
  o Double highWaveLast24Hours default=0.0
  --> Payment settlement optional
}

asset Payment identified by paymentID {
  o String paymentID
  o Double amount
  o DateTime date
  o Boolean approved default=true
  --> BlackPlatformParticipant from
  --> BlackPlatformParticipant to
}

transaction SubmitClaim {
  o String policyID
  o Double rainLast24Hours default=0.0
  o Double cloudsLast24Hours default=0.0
  o Double highTempLast24Hours default=0.0
  o Double highWaveLast24Hours default=0.0
}

event ClaimSubmitted {
  o String policyID
  o String claimID
  o DateTime claimDate
  o Double rainLast24Hours
  o Double cloudsLast24Hours
  o Double highTempLast24Hours
  o Double highWaveLast24Hours
  o String settlementPaymentID
  o Double amount
  o DateTime settlementDate
  o Boolean approved
  o String paidFrom
  o String paidTo
}
*/

/**
 * Submit a 'Rainy Day' claim
 * @param {insure.black.poc.SubmitClaim} claimSubmission
 * @transaction 
 */
function onSubmitClaim(claimSubmission) {
    var policyRegistry, claimRegistry, agencyRegistry, paymentRegistry, syndicateRegistry, policyHolderRegistry;
    var currentPolicy, allPolicyClaims, agency, submittedClaim, settlementPayment, syndicate, policyUnderwriter;
    var newClaimID = claimSubmission.policyID+'_'+(new Date()).getTime().toString();
    var factory = getFactory();

    // Validate the inputs
    transactionRequestingUser = getCurrentParticipant();
    if (transactionRequestingUser.getFullyQualifiedIdentifier() !== 'insure.black.poc.PlatformUser#RAIN_ORACLE') {
      throw new Error('Transaction can only be submitted by RAIN_ORACLE');
    }
  	

    Promise.all([
        getAssetRegistry('insure.black.poc.Policy'),
        getAssetRegistry('insure.black.poc.Claim'),
        getAssetRegistry('insure.black.poc.Payment'),
        getParticipantRegistry('insure.black.poc.InsuranceAgency')    
    ]).then(function(registries){
        policyRegistry = registries[0];
        claimRegistry = registries[1];
        paymentRegistry = registries[2];
        agencyRegistry = registries[3];
      
      	// Get all the objects we need to operate on
      	return Promise.all([
            policyRegistry.get(claimSubmission.policyID),
            agencyRegistry.getAll()
        ]);
    }).then(function(basicReads){
        currentPolicy = basicReads[0];
        agency = basicReads[1].filter(function(value,index,self){return value.broker.participantID == currentPolicy.issuingBroker.participantID;})[0];
      
        // Make sure the last claim did not occur within 24-hours of now
      	var now = new Date();
        var yesterday = new Date(now);
        yesterday.setDate(now.getDate()-1);
        var lastClaimDate = yesterday;
        if ( currentPolicy.lastClaimDate != null ){
            lastClaimDate = currentPolicy.lastClaimDate;
        }        
        if ( (yesterday.getTime() - lastClaimDate.getTime()) < 0 ) {
            return Promise.reject('This Policy has already submitted a Claim in the last 24 hours.');
        }

        // Determine if this is a valid Claim
        if ( claimSubmission.rainLast24Hours < agency.policyClaimRainThreshold ) {
            return Promise.reject('This Claim is not valid. The Claim evidence shows rainfall over the last 24-hours of ' + claimSubmission.rainLast24Hours + ' and the required threshold is ' + agency.policyClaimRainThreshold);
        }    
      
        // Create an unapproved Settlement Payment
        settlementPayment = factory.newResource('insure.black.poc', 'Payment', 'SETTLEMENT_'+newClaimID);
        settlementPayment.date = new Date();
        settlementPayment.from = agency.policyUnderwriter;
        settlementPayment.to = currentPolicy.policyHolder;
        settlementPayment.amount = 1;
        settlementPayment.approved = (agency.autoSettleClaims);

        // Submit the new Claim
        claim = factory.newResource('insure.black.poc', 'Claim', newClaimID);
        claim.claimDate = new Date();
        claim.rainLast24Hours = claimSubmission.rainLast24Hours;
        claim.cloudsLast24Hours = claimSubmission.cloudsLast24Hours;
        claim.highTempLast24Hours = claimSubmission.highTempLast24Hours;
        claim.highWaveLast24Hours = claimSubmission.highWaveLast24Hours;    
        claim.settlement = settlementPayment;
        
        // Update the current Policy to include this new submitted Claim
        if ( currentPolicy.claims == null ) { currentPolicy.claims = new Array(); }
        currentPolicy.claims[currentPolicy.claims.length] = claim;
        currentPolicy.lastClaimDate = claim.claimDate;

        return Promise.all([
            paymentRegistry.add(settlementPayment),
            claimRegistry.add(claim),
            policyRegistry.update(currentPolicy)
        ]);
    }).then(function(claimSubmissionSuccess){        
        // Success, the Claim was submitted to the Blockchain
        var claimSubmissiondEvent = factory.newEvent('insure.black.poc', 'ClaimSubmitted');
        claimSubmissiondEvent.policyID = currentPolicy.policyID;
        claimSubmissiondEvent.claimID = claim.claimID;
        claimSubmissiondEvent.claimDate = claim.claimDate;
        claimSubmissiondEvent.rainLast24Hours = claim.rainLast24Hours;
        claimSubmissiondEvent.cloudsLast24Hours = claim.cloudsLast24Hours;
        claimSubmissiondEvent.highTempLast24Hours = claim.highTempLast24Hours;
        claimSubmissiondEvent.highWaveLast24Hours = claim.highWaveLast24Hours;
        claimSubmissiondEvent.settlementPaymentID = settlementPayment.paymentID;
        claimSubmissiondEvent.amount = settlementPayment.amount;
        claimSubmissiondEvent.settlementDate = settlementPayment.date;
        claimSubmissiondEvent.approved = settlementPayment.approved;
        claimSubmissiondEvent.paidFrom = agency.policyUnderwriter.getIdentifier();
        claimSubmissiondEvent.paidTo = currentPolicy.policyHolder.getIdentifier();
      
        emit(claimSubmissiondEvent);
      
      	return Promise.resolve(true);
    }).catch(function(err){
        console.log(X+' - FOUND AN ERROR');
        console.log(X+err.toString());
        console.log(X+err.stack);
        throw new Error();
    });
}









/*

asset Payment identified by paymentID {
  o String paymentID
  o Double amount
  o DateTime date
  o Boolean approved default=true
  --> BlackPlatformParticipant from
  --> BlackPlatformParticipant to
}

transaction SettleClaim {
  o String policyID
  o String claimID
  o String settlementPaymentID
  o String policyHolderID
  o String policyUnderwriterID
}

event ClaimSettled {
  o String policyID
  o String claimID
  o String settlementPaymentID
  o DateTime settlementDate
  o Boolean approved
}

*/

/**
 * Settle a 'Rainy Day' claim
 * @param {insure.black.poc.SettleClaim} claimToSettle
 * @transaction 
 */
function onSettleClaim(claimToSettle) {
    var policyRegistry, claimRegistry, agencyRegistry, paymentRegistry, syndicateRegistry, policyHolderRegistry;
    var currentPolicy, allPolicyClaims, agency, submittedClaim, settlementPayment, syndicate, policyUnderwriter;
    var newClaimID = claimToSettle.policyID+'_'+(new Date()).getTime().toString();
    var factory = getFactory();

    // Validate the inputs
    transactionRequestingUser = getCurrentParticipant();
    if (transactionRequestingUser.getFullyQualifiedIdentifier() !== 'insure.black.poc.PlatformUser#RAIN_ORACLE') {
        throw new Error('Transaction can only be submitted by RAIN_ORACLE');
    }
  	

    Promise.all([
        getAssetRegistry('insure.black.poc.Payment'),
        getParticipantRegistry('insure.black.poc.Syndicate'),
        getParticipantRegistry('insure.black.poc.PlatformUser')        
    ]).then(function(registries){
        paymentRegistry = registries[0];
        syndicateRegistry = registries[1];
        policyHolderRegistry = registries[2];
      
      	// Get all the objects we need to operate on
      	return Promise.all([
            paymentRegistry.get(claimToSettle.settlementPaymentID),
            syndicateRegistry.get(claimToSettle.policyUnderwriterID),
            policyHolderRegistry.get(claimToSettle.policyHolderID)
        ]);
    }).then(function(readObjects){
        settlementPayment = readObjects[0];
        policyUnderwriter = readObjects[1];
        policyHolder = readObjects[2];

        // Make sure that all parameters match expectations
        if ( settlementPayment.from.getIdentifier() != policyUnderwriter.getIdentifier() || settlementPayment.to.getIdentifier() != policyHolder.getIdentifier() ) {
            return Promise.reject('The provided transaction parameters for Settling a Claim do not match the SettlementPayment TO/FROM values stored in the blockchain.');
        } else if ( settlementPayment.approved == true ){
            return Promise.reject('The Claim Settlement Payment referenced in the transaction parameters was previously approved.');
        }
      
        // Make changes to all objects
        settlementPayment.approved = true;
        settlementPayment.date = new Date();
        policyUnderwriter.balanceBLCK--;
        policyHolder.balanceBLCK++;
      
        // Update the blockchain
        return Promise.all([
            paymentRegistry.update(settlementPayment),
            syndicateRegistry.update(policyUnderwriter),
            policyHolderRegistry.update(policyHolder)
        ]);
    }).then(function(claimSettlementSuccess){        
        // Success, the Claim was settled on the Blockchain
        var claimSettledEvent = factory.newEvent('insure.black.poc', 'ClaimSettled');
        claimSettledEvent.policyID = claimToSettle.policyID;
        claimSettledEvent.claimID = claimToSettle.claimID;
        claimSettledEvent.settlementPaymentID = settlementPayment.paymentID;
        claimSettledEvent.settlementDate = settlementPayment.date;
        claimSettledEvent.approved = settlementPayment.approved;
      
        emit(claimSettledEvent);
      
      	return Promise.resolve(true);
    }).catch(function(err){
        console.log(X+' - FOUND AN ERROR');
        console.log(X+err.toString());
        console.log(X+err.stack);
        throw new Error();
    });
}