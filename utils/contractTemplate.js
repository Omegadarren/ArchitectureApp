const settingsHelper = require('./settingsHelper');

/**
 * Generates complete contract HTML for emails and documents using the actual Omega Builders contract
 * @param {Object} contract - The contract data
 * @returns {string} - Complete contract HTML
 */
async function generateContractHtml(contract) {
    const settings = await settingsHelper.getSettings();
    
    const currentDate = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    const formatDate = (dateString) => {
        if (!dateString) return 'TBD';
        return new Date(dateString).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    };
    
    const formatCurrency = (amount) => {
        if (!amount) return '$0.00';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(amount);
    };

    // Get pay terms for the payment section
    let payTermsHtml = '';
    if (contract.PayTerms) {
        payTermsHtml = contract.PayTerms.replace(/\n/g, '<br>');
    } else {
        payTermsHtml = 'Payment terms to be determined';
    }

    return `<html>
<head>
<meta http-equiv=Content-Type content="text/html; charset=windows-1252">
<meta name=Generator content="Microsoft Word 15 (filtered)">
<style>
<!--
 /* Font Definitions */
 @font-face
	{font-family:"Cambria Math";
	panose-1:2 4 5 3 5 4 6 3 2 4;}
@font-face
	{font-family:Calibri;
	panose-1:2 15 5 2 2 2 4 3 2 4;}
@font-face
	{font-family:Verdana;
	panose-1:2 11 6 4 3 5 4 4 2 4;}
@font-face
	{font-family:Times;
	panose-1:2 2 6 3 5 4 5 2 3 4;}
 /* Style Definitions */
 p.MsoNormal, li.MsoNormal, div.MsoNormal
	{margin-top:0in;
	margin-right:0in;
	margin-bottom:8.0pt;
	margin-left:0in;
	line-height:107%;
	font-size:11.0pt;
	font-family:"Calibri",sans-serif;}
.MsoChpDefault
	{font-family:"Calibri",sans-serif;}
@page WordSection1
	{size:8.5in 11.0in;
	margin:1.0in 1.25in 1.0in 1.25in;}
div.WordSection1
	{page:WordSection1;}
-->
</style>
</head>

<body class=exactforms lang=EN-US>

<div class=WordSection1>

<p class=MsoNormal align=center style='text-align:center'><b><i><span
style='font-size:36.0pt;line-height:107%;font-family:"Times",serif'>OMEGA BUILDERS, LLC</span></i></b><span style='font-size:24.0pt;line-height:107%'> </span></p>

<p class=MsoNormal align=center style='text-align:center'><b><i><span
style='font-size:16.0pt;line-height:107%;font-family:"Times",serif'>DESIGN SERVICES 
CONTRACT</span></i></b><span style='font-size:24.0pt;line-height:107%'> </span></p>

<p class=MsoNormal>&nbsp; </p>

<p class=MsoNormal>&nbsp; </p>

<p class=MsoNormal>This Design Service Contract (the &quot;Contract&quot;) is
made as of ${currentDate} (the &quot;Effective Date&quot;) by and between ${contract.CompanyName || 'Client Name'}
&nbsp;(&quot;Client&quot;) , and ${settings.team_member_full_name || 'Darren Anderson'}
(&quot;Company&quot;) of ${settings.company_name || 'Omega Builders, LLC'}. OMEGA BUILDERS, LLC desires to provide
Design services to Client and Client desires to obtain such services from
Company. THEREFORE, in consideration of the mutual promises set forth below,
the parties agree as follows:</p>

<p class=MsoNormal>&nbsp;</p>

<p class=MsoNormal><b>1. DESCRIPTION OF SERVICES.</b> Beginning on agreed upon
date of approximately <u>${formatDate(contract.StartDate)}</u>, OMEGA BUILDERS, LLC will provide to
Client the services described in the attached Estimate: <u>${contract.EstimateNumber || 'TBD'}</u>
(collectively, the &quot;Services&quot;).</p>

<p class=MsoNormal>&nbsp;</p>

<p class=MsoNormal><b>2. SCOPE OF WORK.</b> OMEGA BUILDERS, LLC will provide all
services, materials and labor for ${contract.ProjectDescription || contract.ProjectName || 'Project as described'}, as described in the attached Estimate: <u>${contract.EstimateNumber || 'TBD'}</u> .</p>

<p class=MsoNormal>&nbsp;</p>

<p class=MsoNormal>Note that the design is intended to follow prescriptive building codes without the need for outside engineering. If engineering is required, 
${settings.company_name || 'Omega Builders, LLC'} will coordinate with an engineer to exchange the necessary information required to complete the process. Engineering fees are to be paid by the client, 
directly to the engineer. Please note that ${settings.company_name || 'Omega Builders, LLC'} has no control over the schedule and time frames of third party vendors. Estimated schedules apply only to work performed by the Company.</p>

<p class=MsoNormal>&nbsp;</p>

<p class=MsoNormal>OMEGA BUILDERS, LLC is only responsible for providing services related to design of the project specified in the estimate, but not related to the tasks and/or
materials specified in estimate <u>${contract.EstimateNumber || 'TBD'}</u> that the Client is responsible for, if any.
OMEGA BUILDERS, LLC is not responsible for any work performed on site or any omission 
therein by the Client or the Client's Contractor. Any changes will not be included 
in original contract agreement unless they are specifically agreed to in writing 
in the form of a change order.</p>

<p class=MsoNormal>&nbsp;</p>

<p class=MsoNormal><b>3. PLANS, SPECIFICATIONS AND CONSTRUCTION DOCUMENTS. </b>Client
will make available to ${settings.company_name || 'Omega Builders, LLC'} all plans, specifications, drawings,
blueprints, and similar construction documents necessary for ${settings.company_name || 'Omega Builders, LLC'} to
provide the Services described herein. Any such materials shall remain the
property of Client. ${settings.company_name || 'Omega Builders, LLC'} will promptly return all such materials to
Client upon completion of the Services, where appropriate. In cases where the scope of
work includes design and drafting services ${settings.company_name || 'Omega Builders, LLC'} will, based upon
input from customer, generate a rough draft set of plans for review by the
Client. Client will then have the opportunity to review the rough draft and red
line for revisions to be submitted back to ${settings.company_name || 'Omega Builders, LLC'}. ${settings.company_name || 'Omega Builders, LLC'} agrees to
make revisions as noted by Client up to 5 times, thus creating the final draft set of plans.
Any further revisions will be at the sole discretion of ${settings.company_name || 'Omega Builders, LLC'} and may
require additional compensation from the Client to the ${settings.company_name || 'Omega Builders, LLC'}. If the number of required revisions
exceeds 5, through no fault of ${settings.company_name || 'Omega Builders, LLC'}, Client understands that additional compensation
to ${settings.company_name || 'Omega Builders, LLC'} may be required.</p>

<p class=MsoNormal>&nbsp;</p>

<p class=MsoNormal><b>4. COMPLIANCE WITH LAWS.</b> ${settings.company_name || 'Omega Builders, LLC'} shall provide the
Services in a workmanlike manner, and in compliance with all applicable
federal, state and local laws and regulations, including, but not limited to
all provisions of the Fair Labor Standards Act, the Americans with Disabilities
Act, and the Federal Family and Medical Leave Act.</p>

<p class=MsoNormal>&nbsp;</p>

<p class=MsoNormal><b>5. WORK SITE.</b> Client warrants that Client owns the
property herein described and is authorized to enter into this contract.</p>

<p class=MsoNormal>&nbsp;</p>

<p class=MsoNormal>&nbsp;</p>

<p class=MsoNormal><b>6. PAYMENT.</b> Payment shall be made to: <u>${settings.company_name || 'Omega Builders, LLC'}, ${settings.company_address || 'Company Address'}</u></p>

<p class=MsoNormal>&nbsp;</p>
<p class=MsoNormal>&nbsp;</p>
<p class=MsoNormal>&nbsp;</p>
<p class=MsoNormal>&nbsp;</p>
<p class=MsoNormal>&nbsp;</p>
<p class=MsoNormal>&nbsp;</p>
<p class=MsoNormal>&nbsp;</p>

<p class=MsoNormal>Client agrees to pay ${settings.company_name || 'Omega Builders, LLC'} as follows:</p>

<p class=MsoNormal>&nbsp;<b><span style='font-size:14.0pt;line-height:107%'>Total
Contract amount: ${formatCurrency(contract.ContractAmount)}</span></b></p>

<p class=MsoNormal>&nbsp;${payTermsHtml}&nbsp;</p>

<p class=MsoNormal><u>*Depending on change order amounts, these will be billed
out separately and may need to be paid sooner than the milestones listed above.
Note: It is recommended that Client have available a minimum of 20% of the
total bid for potential cost overruns, not including client requested changes.
It is also important to note that the contract is based on a provided estimate.
While every effort is made to provide all anticipated costs in the estimate, it
is not unusual for additional costs to arise throughout the process. The client is responsible for payment to cover these additional costs.</u></p>


<p class=MsoNormal>&nbsp;</p>

<p class=MsoNormal>If any invoice is not paid when due, interest will be added
to and payable on all overdue amounts at 15 percent per year, or the maximum percentage
allowed under applicable laws, whichever is less. Client shall pay all costs of
collection, including without limitation, reasonable attorney fees.</p>

<p class=MsoNormal>&nbsp;</p>

<p class=MsoNormal>In addition to any other right or remedy provided by law, if
Client fails to pay for the Services when due, ${settings.company_name || 'Omega Builders, LLC'} has the option to
treat such failure to pay as a material breach of this Contract, and may cancel
this Contract and/or seek legal remedies.</p>

<p class=MsoNormal>&nbsp;</p>

<p class=MsoNormal><b>7. TERM.</b> ${settings.company_name || 'Omega Builders, LLC'} shall commence the work to be
performed on approximately <u>${formatDate(contract.StartDate)}</u> and shall have a target
completion date of ${formatDate(contract.EstimatedCompletionDate)}, taking into consideration any time
delays due to unforeseen circumstances. Please keep in mind that estimated schedules and/or completion dates apply only to work performed by the Company, 
not third party vendors, such as structural engineers, as an example. ${settings.company_name || 'Omega Builders, LLC'} agrees to provides only the services outlined in estimate <u>${contract.EstimateNumber || 'TBD'}</u>. 
All construction activities and coordination after the permit is issued, including
coordination with the managing jurisdiction, are the sole responsibility of the client. ${settings.company_name || 'Omega Builders, LLC'} assumes no liability for the
execution or quality of the construction process. ${settings.company_name || 'Omega Builders, LLC'} responsibility ends at permit issuance, or drawing completion with respect to the included items in the estimate.
Please note that you will likely not be the only client that the ${settings.company_name || 'Omega Builders, LLC'} will be
working for at the time of your project.</p>

<p class=MsoNormal>&nbsp;</p>



<p class=MsoNormal><b>8. CHANGE ORDER.</b> Client, or any allowed person, e.g.
lender, public body, or inspector, may make changes to the scope of the work
from time to time during the term of this Contract. However, any such change or
modification shall only be made in a written &quot;Change Order&quot; which is
signed and dated by both parties. Such Change Orders shall become part of this
Contract. Client agrees to pay any increase in the cost of the services as a result of any written, 
dated and signed Change Order. In the event
the cost of a Change Order is not known at the time a Change Order is executed,
${settings.company_name || 'Omega Builders, LLC'} shall estimate the cost thereof and Client shall pay the actual cost
whether or not this cost is in excess of the estimated cost.</p>

<p class=MsoNormal>&nbsp;</p>

<p class=MsoNormal><b>9. PERMITS. </b>In cases where ${settings.company_name || 'Omega Builders, LLC'} agrees to coordinate the submittal and
acquisition of building permits, the Client will be responsible for paying
permit fees directly to the permitting agency. Please note that in rare circumstances, projects may
not be permittable as requested. ${settings.company_name || 'Omega Builders, LLC'} assumes no responsibility or liability for unpermittable projects 
and full payment is still required as agreed to in this contract.</p>

<p class=MsoNormal>&nbsp;</p>


<p class=MsoNormal><b>10. CONFIDENTIALITY.</b> ${settings.company_name || 'Omega Builders, LLC'}, and its employees,
agents, or representatives will not at any time or in any manner, either
directly or indirectly, use for the personal benefit of ${settings.company_name || 'Omega Builders, LLC'}, or divulge,
disclose, or communicate in any manner, any information that is proprietary to
Client. ${settings.company_name || 'Omega Builders, LLC'} and its employees, agents, and representatives will protect
such information and treat it as strictly confidential. This provision will
continue to be effective after the termination of this Contract.</p>

<p class=MsoNormal>&nbsp;</p>

<p class=MsoNormal>Upon termination of this Contract, ${settings.company_name || 'Omega Builders, LLC'} will return to
Client all records, notes, documentation and other items that were used,
created, or controlled by ${settings.company_name || 'Omega Builders, LLC'} during the term of this Contract.</p>

<p class=MsoNormal>&nbsp;</p>

<p class=MsoNormal>&nbsp;</p>

<p class=MsoNormal><b>11. FREE ACCESS TO WORKSITE.</b> Client will allow free
access to work areas for ${settings.company_name || 'Omega Builders, LLC'}, with appropriate notice, should the need arise.</p>


<p class=MsoNormal>&nbsp;</p>

<p class=MsoNormal><b>12. INSPECTION.</b> Client shall have the right to
inspect all work performed under this Contract. All defects and uncompleted
items shall be reported immediately.</p>

<p class=MsoNormal>&nbsp;</p>

<p class=MsoNormal><b>13. DEFAULT.</b> The occurrence of any of the following
shall constitute a material default under this Contract:</p>

<p class=MsoNormal>&nbsp;</p>

<p class=MsoNormal>a.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; The failure of
Client to make a required payment when due.</p>

<p class=MsoNormal>&nbsp;</p>

<p class=MsoNormal>b.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; The insolvency of
either party or if either party shall, either voluntarily or involuntarily,
become a debtor of or seek protection under Title 11 of the United States
Bankruptcy Code.</p>

<p class=MsoNormal>&nbsp;</p>

<p class=MsoNormal>c.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; A lawsuit is
brought on any claim, seizure, lien or levy for labor performed or materials
used on or furnished to the project by either party, or there is a general
assignment for the benefit of creditors, application or sale for or by any
creditor or government agency brought against either party.</p>

<p class=MsoNormal>&nbsp;</p>

<p class=MsoNormal>d.&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; The failure of
Client to make the building site available or the failure of ${settings.company_name || 'Omega Builders, LLC'} to
deliver the Services in the time and manner provided for in this Contract.</p>

<p class=MsoNormal>&nbsp;</p>

<p class=MsoNormal><b>14. REMEDIES.</b> In addition to any and all other rights
a party may have available according to law of the State of Washington, if a
party defaults by failing to substantially perform any provision, term or
condition of this Contract (including without limitation the failure to make a
monetary payment when due), the other party may terminate the Contract by providing
written notice to the defaulting party. This notice shall describe with
sufficient detail the nature of the default. The party receiving said notice
shall have 10 days from the effective date of said notice to cure the
default(s) or begin substantial completion if completion cannot be made in 10
days. Unless waived by a party providing notice, the failure to cure or begin
curing, the default(s) within such time period shall result in the automatic
termination of this Contract.</p>

<p class=MsoNormal>&nbsp;</p>

<p class=MsoNormal><b>15. FORCE MAJEURE.</b> If performance of this Contract or
any obligation under this Contract is prevented, restricted, or interfered with
by causes beyond either party's reasonable control (&quot;Force Majeure&quot;),
and if the party unable to carry out its obligations gives the other party prompt
written notice of such event, then the obligations of the party invoking this
provision shall be suspended to the extent necessary by such event. The term
Force Majeure shall include, but not be limited to, acts of God, fire,
explosion, vandalism, storm, casualty, illness, injury, general unavailability
of materials or other similar occurrence, orders or acts of military or civil
authority, or by national emergencies, insurrections, riots, or wars, or
strikes, lock-outs, work stoppages, or other labor disputes, or supplier
failures. The excused party shall use reasonable efforts under the
circumstances to avoid or remove such causes of non-performance and shall
proceed to perform with reasonable dispatch whenever such causes are removed or
ceased. An act or omission shall be deemed within the reasonable control of a
party if committed, omitted, or caused by such party, or its employees,
officers, agents, or affiliates.</p>

<p class=MsoNormal>&nbsp;</p>

<p class=MsoNormal><b>16. ARBITRATION. </b>Any controversy or claim arising out
of or relating to this Contract, or the breach thereof, shall be settled by
arbitration administered by the American Arbitration Association in accordance
with its Commercial Arbitration Rules [including the Optional Rules for
Emergency Measures of Protection], and judgment on the award rendered by the
arbitrator(s) may be entered in any court having jurisdiction thereof. During
any arbitration proceedings related to this Contract, the parties shall
continue to perform their respective obligations under this Contract. In the
event arbitration is necessary, each party shall be solely responsible for its
attorney fees and costs.</p>

<p class=MsoNormal>&nbsp;</p>

<p class=MsoNormal><b>17. ENTIRE CONTRACT.</b> This Contract contains the
entire Contract of the parties, and there are no other promises or conditions
in any other contract whether oral or written concerning the subject matter of
this Contract. Any amendments must be in writing and signed by each party. This
Contract supersedes any prior written or oral agreements between the parties.</p>

<p class=MsoNormal>&nbsp;</p>

<p class=MsoNormal><b>18. SEVERABILITY.</b> If any provision of this Contract
will be held to be invalid or unenforceable for any reason, the remaining
provisions will continue to be valid and enforceable. If a court finds that any
provision of this Contract is invalid or unenforceable, but that by limiting
such provision it would become valid and enforceable, then such provision will
be deemed to be written, construed, and enforced as so limited.</p>

<p class=MsoNormal>&nbsp;</p>

<p class=MsoNormal><b>19. AMENDMENT.</b> This Contract may be modified or
amended in writing, if the writing is signed by each party.</p>

<p class=MsoNormal>&nbsp;</p>

<p class=MsoNormal><b>20. GOVERNING LAW.</b> This Contract shall be construed
in accordance with, and governed by the laws of the State of Washington,
without regard to any choice of law provisions of Washington or any other
jurisdiction.</p>

<p class=MsoNormal>&nbsp;</p>

<p class=MsoNormal><b>21. NOTICE.</b> Any notice or communication required or
permitted under this Contract shall be sufficiently given if delivered in
person or by certified mail, return receipt requested, to the address set forth
in the opening paragraph or to such other address as one party may have
furnished to the other in writing. This includes electronic communication such as email, text, etc.</p>


<p class=MsoNormal><b>22. HOLD HARMLESS.</b> Omega Builders, LLC shall not be 
held responsible for work performed by third party contractor that does not meet code 
or is otherwise substandard, or fails to meet customer's satisfaction. It is assumed that any contractor hired to perform the 
work outlined in these plans is competent and capable of doing so, and competent to 
resolve unforeseen issues that may arise. ${settings.company_name || 'Omega Builders, LLC'} is responsible for verifying all 
information contained within these plans.</p>

<p class=MsoNormal>&nbsp;</p>

<p class=MsoNormal><b>23. WAIVER OF CONTRACTUAL RIGHT.</b> The failure of
either party to enforce any provision of this Contract shall not be construed
as a waiver or limitation of that party's right to subsequently enforce and
compel strict compliance with every provision of this Contract.</p>

<p class=MsoNormal>&nbsp;</p>

<p class=MsoNormal><b>24. ASSIGNMENT.</b> Neither party may assign or transfer
this Contract without the prior written consent of the non-assigning party,
which approval shall not be unreasonably withheld.</p>

<p class=MsoNormal>&nbsp;</p>

<p class=MsoNormal><b>25. COMMUNICATION.</b> Email is the preferred method of communication, please do not call me 
unless it is absolutely unavoidable. Technical information is not best exchanged via phone call and I will likely be working on another 
project at the time of your call. As a result, I am typically unable to answer the phone and not likely to listen to your voicemail. Thank 
you for you cooperation in this matter. </p>

<p class=MsoNormal><b>26. SIGNATORIES. </b>This Contract shall be signed on
behalf of <u>Client</u>, by ${contract.ContactName || 'Customer Contact'}, and on behalf of ${settings.company_name || 'Omega Builders, LLC'}
(${settings.company_name || 'Omega Builders, LLC'}'s License: ${settings.company_license || 'OMEGABL833BK'}) by ${settings.team_member_full_name || 'Darren Anderson'}, ${settings.team_member_title || 'President'},<b> </b>and shall be effective
as of the date first written above.</p>

<p class=MsoNormal>&nbsp; </p>

<p class=MsoNormal style='page-break-after:avoid'>Client: (Print Name)</p>

<p class=MsoNormal style='page-break-after:avoid'>&nbsp;</p>

<p class=MsoNormal style='page-break-after:avoid'>${contract.CompanyName || 'Customer Name'}</p>

<p class=MsoNormal style='page-break-after:avoid'>&nbsp; </p>

<p class=MsoNormal style='page-break-after:avoid'>By: (Sign, Date)</p>

<p class=MsoNormal style='page-break-after:avoid'>&nbsp;</p>

<p class=MsoNormal style='page-break-after:avoid'>&nbsp;________________________________________
</p>

<p class=MsoNormal>&nbsp; </p>

<p class=MsoNormal>&nbsp; </p>

<p class=MsoNormal style='page-break-after:avoid'>${settings.company_name || 'Omega Builders, LLC'}: <u>${settings.company_name || 'Omega Builders, LLC'}</u></p>

<p class=MsoNormal style='page-break-after:avoid'>&nbsp; </p>

<p class=MsoNormal>Company Name & License: <b>${settings.company_name || 'Omega Builders, LLC'} - ${settings.company_license || 'OMEGABL833BK'}</b></p>

<p class=MsoNormal style='page-break-after:avoid'>&nbsp; </p>

<p class=MsoNormal>By:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${settings.team_member_full_name || 'Darren Anderson'} &nbsp;&nbsp;&nbsp;Title: ${settings.team_member_title || 'President'}${settings.signature_image_url ? '&nbsp;&nbsp;&nbsp;<img src="' + settings.signature_image_url + '" alt="Digital Signature" style="max-height: 80px; vertical-align: middle; margin-left: 10px; background-color: white; mix-blend-mode: multiply;">' : ''}</p>

<p class=MsoNormal>&nbsp;</p>
<p class=MsoNormal>&nbsp;</p>


<p class=MsoNormal>Date _____<u><span style='font-size:10.0pt;line-height:107%;
font-family:"Verdana",sans-serif'>${currentDate}</span></u></p>


</div>

</body>

</html>`;
}

module.exports = {
    generateContractHtml
};
